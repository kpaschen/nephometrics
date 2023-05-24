---
title: "Unit testing Spark Scala code"
date: 2019-05-16T12:23:24+02:00
draft: false
tags: ["spark", "scala", "unittests"]
---

Unit tests. They're a good thing. I use them even in single-person projects,
because I like being able to double-check my own logic, and because
it's less effort to run a couple tests than to remember the way my code
interacts with my other code every time I make a change.

I actually test pipeline code, too. I know this is a little uncommon -- some
people believe that if there is a mistake in their code, they will know because
their pipeline will fail. I don't follow this logic: one, not all mistakes cause
pipeline failures. What if you have a subtle math error in your pipeline that
causes you to miscalculate, say, your customers' clickthrough rates?
The pipeline infrastructure does not care that your code does not reflect your
intentions correctly; it will do what you told it to do.

Two, pipeline failures can be pretty expensive themselves. An hour of one
relatively wimpy instance on Amazon EMR (say c3.2xlarge, the smallest type
currently available in Frankfurt) only comes to [about $0.63](
https://calculator.s3.amazonaws.com/index.html#s=EMR), but most pipelines
will need more and bigger instances and run for several hours. And then you'll
have to debug your pipeline, probably under time pressure because it needs to run
because something else needs the data.
Surely it's better all around to test before you deploy.

Recently I've been working on my Scala skills after years of mostly C++ and Python,
and thought I'd write up what I found out about testing Spark pipeline code
written in Scala. Where I've found good writeups, I've linked to them, and tried
what they recommended for myself. If you notice that my Scala style is less than
idiomatic, this is because I'm still figuring out what works best --- if you
can spare the time, please [drop me a note](mailto:contact@paschen.ch) with your
improvements!

### Testing styles

Scala has a unit testing framework called [scalatest](http://www.scalatest.org/user_guide). It gives you a choice of testing styles ranging from `FunSuite`, which looks
reassuringly familiar if you come from `xUnit`-style testing, to various types
of `Spec`-based tests that (I think) are intended to make it easier to express
the behaviour your test should be verifying. 

### Background for the example

For the examples below, I have used code from a pipeline evaluating citations
of computer science publications based on a data dump obtained from
[dblp](http://dblp.uni-trier.de"). [DBLP make their data available](https://dblp.uni-trier.de/faq/1474677.html) under an Open Data Commons ODC-By 1.0 License.

The data I have is in json format. The fields I use are:

   * year (the year the paper was published)
   * id (a string id for the publication)
   * references (a list of publication ids, can be null)
    
Other fields are available, e.g. `venue` (name of conference or journal),
`authors` (list of author names) and of course `title`, `abstract` etc. The data
also contains a field called `n_citation` that should be the number of times
the paper was cited; however, a lot of records have a value of `50` there, so I
suspect the value is capped. There are a few interesting "impurities" in the
data, for example some publications that seem to have been cited before they
were published; this usually appears to be a merge artifact, where a famous paper
was re-issued in a collection and DBLP merged two publication records into one
(which may be correct) and used the later publication date (which is not
correct in all cases).

I wanted to see how the number of citations a paper attracts develops over time,
so originally I made a Jupyter notebook. And then I wanted to have a
 simple-but-not-trivial example for trying some Scala
features, so I decided to use the DBLP data.

First, here's the first few pieces of the Scala code:
```
package com.nephometrics.dblp

import org.apache.spark.sql.{DataFrame, Dataset, Row}
import org.apache.spark.sql.SparkSession


case class BasePublication(id: String, references: Array[String], year: Int)

class Citations(@transient val spark: SparkSession) {

  def this() = this(SparkSession.builder.getOrCreate())

  import spark.implicits._

  def idRefYearDs(baseData: DataFrame): Dataset[BasePublication] = {
    baseData.select("id", "references", "year").filter(
      "references is not NULL").as[BasePublication]
  }

  // Take a dataset of BasePublications, invert on the reference ids,
  // group by reference id + yearCited, sum the citation counts.
  def countCitationsByYear(publications: Dataset[BasePublication]): Dataset[(String, Int)] = {
     val citedPublications = publications.flatMap(row =>
         for(b <- row.references) yield (b + "." + row.year, 1))
     citedPublications.groupByKey(_._1).reduceGroups(
       (a, b) => (a._1, a._2 + b._2)).map(_._2)
  }
}
```

This code uses Datasets wherever possible because it seems worth trying. I might
write another blog post about how the code differs when I allow myself to use
Dataframes or even RDDs in a few places, and what implications that might have
for performance.

One thing to note is that transforming `baseData` into a `Dataset[BasePublication]`
requires an import of `spark_implicits._` or a custom Encoder. I found this a little
awkward because I like to write my base logic without depending on a SparkSession
(cue the "what is a true Unit Test" discussion), but creating a custom Encoder
just to keep my Unit Tests pure did not seem like a good idea either.

I wrote the code so that it can either `getOrCreate()` a SparkSession using
the default builder or take one as a parameter to the constructor of the
`Citations` class. This is so I can "inject" a pre-constructed SparkSession, e.g.
one that is set up for testing. More on why that matters below. I have marked
the SparkSession field `@transient` to exclude it from serialization.

### A basic Unit Test

Here is a very basic test, "FunSuite" style.

```
package com.nephometrics.dblp

import org.apache.spark.sql.types._
import org.apache.spark.sql.SparkSession
import org.scalatest.FunSuite

// This just makes it easier to create test data.
case class Publication(id: String, year: Int, venue: String,
  references: Option[Array[String]])

class DblpCitationsTest extends FunSuite {

  // Do not copy this code! You probably want to put
  // it into a beforeAll() or beforeEach() method, and
  // add some useful options (explained below).
  val spark: SparkSession = SparkSession.builder().appName(
       "citations").master("local").getOrCreate()

  import spark.implicits._

  // pub1 published year 10, no citations
  // pub2 published year 9, cited by pub1 and pub5 in year 10 (at age 1)
  // pub3 published year 8, cited by pub2 in year 9 and pub1 in year 10
  // pub5 published in year 10, no citations
  // pub4 does not have an entry
  val sourceDF = Seq(
    Publication("pub1", 10, "here", Some(Array("pub2", "pub3"))),
    Publication("pub2", 9, "there", Some(Array("pub3", "pub4"))),
    Publication("pub3", 8, "there", None),
    Publication("pub5", 10, "there", Some(Array("pub2", "pub4"))),
  ).toDF()

  val stats = new Citations(spark)

  test("citations are counted by year") {
    val ds = stats.idRefYearDs(sourceDF)
    val counted = stats.countCitationsByYear(ds)
    val results = counted.collect()
    assert(5 == counted.count())

    for (r <- results) {
      if (r._1 == "pub2.10") {
        assert(2 == r._2)
      } else {
        assert(Array("pub3.9", "pub3.10", "pub4.10", "pub4.9").contains(r._1))
        assert(1 == r._2)
      }
    }
  }
```

and, for completeness, here is a basic `build.sbt` file:
```
name := "DBLP-Scala"
version := "0.9"
scalaVersion := "2.12.8"
val sparkVersion = "2.4.2"
scalacOptions += "-target:jvm-1.8"
javaOptions ++= Seq("-Xms512M", "-Xmx2048M", "-XX:+CMSClassUnloadingEnabled")
fork in Test := true
parallelExecution in Test := false
testOptions in Test += Tests.Argument(TestFrameworks.ScalaTest, "-oD")
libraryDependencies ++= Seq(
  "org.apache.spark" %% "spark-core" % sparkVersion,
  "org.apache.spark" %% "spark-sql" % sparkVersion,

  "org.scala-lang" % "scala-reflect" % "2.12.8",
  "org.scalatest" %% "scalatest" % "3.2.0-SNAP9" % Test
```

I specify a target JVM because I also have Java 10 installed and some spark
features don't work with it.

The Java memory options are there to avoid running out of memory when I
run tests repeatedly from an sbt shell.

The `-oD` test option enables timing information for tests.

The line `fork in Test := true` tells sbt to fork the JVM. [This avoids an
sbt restart if a test causes the JVM to shut down.](
https://stackoverflow.com/questions/44298847/why-do-we-need-to-add-fork-in-run-true-when-running-spark-sbt-application
)

The line `parallelExection in Test := false` makes sure tests are executed serially.
I've seen this recommended especially when you create a separate SparkSession
 for every test though I have not been able to get my tests to fail when I leave
this setting out.
 I enabled it here because I wanted to measure test running times independently, and
it seemed best to run them serially for that purpose.

Note that while this `build.sbt` file works fine for tests, I have had some grief
packaging my code and running `spark-submit` on the resulting `.jar` file where
the pipeline fails with a `NoClassDefFoundError` for
 `scala/runtime/LambdaDeserialize`. As best I can tell so far, this tends to be
caused by version mismatches or incompatible versions e.g. of scala and spark.
If I figure out a generic way to diagnose and fix this kind of issue, I'll write
it up as a separate blog post; right now I can basically poke at this kind of issue until
it works, but I don't think I can explain why in a helpful way.

### Spark Sessions in Unit Tests

As mentioned above, you will need a SparkSession to run most of the code
 you want to test.
A unit testing purist will tell you that if you need a Spark Context or Session,
your test has strayed from Unit Test into Integration Test territory.
If you want to follow that line, you could break out "just the logic" of your
 code into
a scala library that you test with "real" unit tests and then write integration
tests for the other parts. 
It's a clean way to structure your code and probably makes sense especially for
 large code bases. 

For my own purposes, I refer to fast, frequently run tests as Unit Tests even
when they use a SparkSession; what matters to me is how I use them.

#### Creating a Spark Session

So let's look at how to create a SparkSession for Tests. I've shown one
option above where I create a custom SparkSession in the Test Suite class
and pass it to the constructor of the class I'm testing.

This is ok, but there are cleaner ways to structure this code.
The Scalatest library has `before` and `after` fixtures that you can use for
setup and teardown around your tests. These come in `Each` and `All` variants
(executed before and after every test vs. before and after the entire test 
suite).

You can use `beforeAll` to set up a spark session that can then get used by
every test, like so:

```
import org.scalatest.BeforeAndAfterAll

class DblpCitationsTest extends FunSuite with BeforeAndAfterAll {
  var stats: Citations = _

  override def beforeAll(): Unit = {
    val spark: SparkSession = SparkSession
    .builder()
    .appName("citations")
    .master("local")
    .getOrCreate()
  }

  stats = new Citations(spark)
  super.beforeAll()
}
```

You can declare this using `beforeEach` in pretty much the same way, and it
will have a very similar effect because `getOrCreate()` will return the
current Spark Session if one already exists. I wrote "similar" and not "the same"
because may you run your tests in parallel in separate threads and use
[thread-local SparkSessions](https://spark.apache.org/docs/2.3.0/api/java/org/apache/spark/sql/SparkSession.Builder.html#getOrCreate--). Or maybe
you implement an `afterEach()` method that calls `spark.stop()` -- that
will stop your spark session after every test, so you will get a new one
the next time you call `getOrCreate()`. 

[The scalatest docs](http://doc.scalatest.org/1.8/org/scalatest/FunSuite.html) explain more about the options here,
e.g. how to run tests with fixtures, and run the same test with different
fixtures.

More examples and utilities:

   1. [Holden Karau's spark-testing-base package](https://github.com/holdenk/spark-testing-base/) will create a spark context for you if you
mix a relevant trait into your test class
   1. [spark-fast-tests](https://github.com/MrPowers/spark-fast-tests/) shows how to use a `SparkSessionTestWrapper` trait that gives you some control over the spark
session and only instantiates one per test suite.

Just to experiment, I added a second test to my suite, ran `test` from
the sbt shell and looked at how long it took. Of course the raw number of
seconds is meaningless
by itself because a lot depends on the specs of the machine running the test and
what else is running on it. I ran this on a machine with four CPUs (well, two cores
with two hardware threads each) and 8 gigs of RAM that wasn't doing much else
at the time besides a couple of vim sessions. I ran the test suite with a
`beforeAll()` setup a few times
and results were between 15 and 19 seconds. That seems like a lot for two
simple tests.

Does it get worse if I create a new Spark Session for every test? Actually, it
gets faster (takes about 14 seconds per run). That seems counterintuitive at first,
but more investigation showed that creating and stopping Spark Sessions was actually
not the main thing slowing my tests down -- my test suite only contained
two tests, and moreover, I had not yet used some other good optimization options.

#### Configuring a Spark Session for testing

I ran my tests using `sbt test 2>/tmp/sparktest.log` and went over the logs in
more detail.

The suite now has two tests, the first one is called `BaseDataConversion`
and it just creates a DataFrame with the base data, converts it into a Dataset,
and counts the number of entries. The second one is the `citations are counted
by year` test for which I included the code above.

SBT reported:
```
[info] DblpCitationsTest:
[info] - BaseDataConversion (2 seconds, 79 milliseconds)
[info] - citations are counted by year (4 seconds, 723 milliseconds)
[info] Run completed in 13 seconds, 511 milliseconds.
[info] Total number of tests run: 2
[info] Suites: completed 1, aborted 0
[info] Tests: succeeded 2, failed 0, canceled 0, ignored 0, pending 0
[info] All tests passed.
[success] Total time: 16 s, completed May 20, 2019, 11:27:57 AM
```

SBT reported 16s total time for this test, of which 13s 511 milliseconds
were spent on the `test run`, 2s 79 ms on the first test, and
4s 723 ms on the second. The first
4s or so of the total time are not recorded in the log file so I'll assume
those were spent starting up sbt, loading the project definition
and settings.

I don't know which operations went into the 2s 79 ms that sbt reported for the first
test; from the log file, it seems like 6s passed between "start the context"
and "start job for action", the `count` action took about 620ms, and then teardown
took less than 1s.

For the second test, it's 2s to start up services, 1.6s to run the job,
less than 1s for teardown. It's consistently faster to start services for the
second test even with a `spark.stop()` call in `afterEach()`
I suspect this is because the first session start will bring up
a couple of servers (like the block manager) that (as far as I can tell) are left
running even when you call `spark.stop()`. 

Overall this is a pretty dismally long running time for a couple of very simple
tests. I went over the steps outlined [here](https://medium.com/@mrpowers/how-to-cut-the-run-time-of-a-spark-sbt-test-suite-by-40-52d71219773f) to optimize. The
most effective step is to run tests from the sbt shell instead of making
separate sbt calls from the commandline, since this saves a lot of startup time.
For the following tests, I ran from the commandline anyway because I wanted to
be able to redirect stderr to different log files for different versions of the
code.

Another recommendation is to set the number of shuffle partitions to 1.
The log files for the second test show 200 tasks launched for shuffling, so this
looked like a promising thing to try.

Add `.config("spark.sql.shuffle.partitions", "1")` to the configuration of
the spark session builder, and we get:

```
[info] DblpCitationsTest:
[info] - BaseDataConversion (1 second, 803 milliseconds)
[info] - citations are counted by year (1 second, 404 milliseconds)
[info] Run completed in 10 seconds, 630 milliseconds.
[info] Total number of tests run: 2
[info] Suites: completed 1, aborted 0
[info] Tests: succeeded 2, failed 0, canceled 0, ignored 0, pending 0
[info] All tests passed.
[success] Total time: 20 s, completed May 20, 2019, 12:11:34 PM
``` 

The time spent on running the tests has come down nicely. The total time
is up though -- from the log file, it looks like it took 11s to start sbt
and compile the code this time. This would get better if I used the sbt
shell, and it will also amortize for large test suites.

 Inside the tests, the `count`
action from the first unit test took 520ms this time (it does not need to shuffle
so the number of shuffle partitions should have no effect on it), while the
`collect` call in the second test is down to 469ms now. As
mentioned above, the raw numbers are almost meaningless, but the reduction
in running time from 1.6s to 469ms is nice.

[The medium post I referenced above](
https://medium.com/@mrpowers/how-to-cut-the-run-time-of-a-spark-sbt-test-suite-by-40-52d71219773f) also talks about using a single SparkSession
and SparkContext instead of creating a new one for every test.
I experimented with this, but did not see significant impact on running
times; but then, I only have two tests.

Next, I don't need spark to run a UI server during tests, so remove that as well:

`.config("spark.ui.enabled", "false")`.

This has no noticeable impact on performance but still seems worth doing.

Once I felt like I would not want to read the detailed log output any more,
I added this line:

`spark.sparkContext.setLogLevel(org.apache.log4j.Level.ERROR.toString()`

It had little to no impact on running times, but when I redirected `stderr` to
`/dev/null`, I got the total wall time down to 12s, which is nice. Now I run
my tests like this:

`sbt test 2> /dev/null`

so I still get the test results on stdout and then if I see a failure, I can re-run
without the redirect to get the logs.

To be sure, 12 seconds is still longer than I want for unit tests though. Based
on the timing above, most of the time is spent in starting sbt, compiling code, and bringing up the spark context and servers.

#### Code structure and testability

Spark Scala code is often written in the 'fluent' style, with chains of method
invocations. This can make it a bit more difficult to diagnose bugs that are
buried in the middle of a chain. Debugging is doable in the scala shell of course,
but I like to write my unit tests with a focus on small pieces of logic. Maybe
that means I test too much of the implementation as opposed to the end to end
behaviour; I just find it works for me.

I usually break the whole pipeline down into methods of 15-30 lines that represent
what I think of as "chunk"s of logic. I test those methods individually, and
then I assemble them into a pipeline and test the pipeline end to end. Performance-wise,
this makes no difference so long as the methods do not introduce
extra actions.

Fortunately, my approach does not even make a performance difference during testing;
at least based on my observations, it looks as though Spark is clever enough
to cache and re-use intermediate results. I was pretty happy when I noticed that.

Here is an example:
```
  test("citations are counted by year") {
    val counted = stats.countCitationsByYear(baseDataSet)
    val results = counted.collect()
    assert(5 == counted.count())

    for (r <- results) {
      if (r._1 == "pub2.10") {
        assert(2 == r._2)
      } else {
        assert(Array("pub3.9", "pub3.10", "pub4.10", "pub4.9").contains(r._1))
        assert(1 == r._2)
      }
    }
  }

   test("citation age is computed from year published and year cited") {
    val counted = stats.countCitationsByYear(baseDataSet)
    val cited = stats.countCitationsByAge(counted, sourceDF)
    val results = cited.collect()
    assert(5 == cited.count())

    // More assertions come here
   }
```

During testing, I noticed that the "citation age" test is consistently slower
 when I remove the "citations are counted" test. Test timing and logs comparison
shows Spark does not (or at least not always) re-compute `counted` for the second
test if it's already been computed for the first. I specify serial execution of
my tests to make sure I can take advantage of this.

My pipeline takes a `sourceDF` and does something like this:

```
val baseDataSet = idRefYearDs(sourceDF)
val counted = countCitationsByYear(baseDataSet)
val cited = countCitationsByAge(counted, sourceDF)
// ... more transformations after this ...
```

For the optimized plan that Spark creates when I call an
action, it makes no difference whether I split things up into methods
 and assign intermediate
results to `val`s. Maybe I'll adopt more
of the fluent style over time and change the way I test, but for now, it is reassuring
to know I can test in small chunks.

There is a situation where breaking out a separate method does make running
in Spark more difficult: trying to pass a locally defined method
into something like `map()`. [More background here](https://medium.com/onzo-tech/serialization-challenges-with-spark-and-scala-a2287cd51c54), but the upshot is that
if you're asking for code to be executed on worker nodes, Spark needs to send
that code to those nodes. It does this by serializing the object that defines the
code; and of course it needs to have access to the values of the variables
to be passed to the code. You need to make sure the object in question is actually
Serializable, and you (probably) want to make sure to keep that object small.

One more thing to note in this context is that a method declared with `def` will
contain a reference to `this` ([Background](https://alvinalexander.com/scala/fp-book-diffs-val-def-scala-functions)), so if `this` is not Serializable, or if you just don't want it to be serialized, use `val` not `def` to declare the function that
you want the worker nodes to execute.
