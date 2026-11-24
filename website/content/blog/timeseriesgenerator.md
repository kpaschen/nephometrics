---
title: "Time series, lots of time series (and how to generate them)"
date: 2026-11-04T11:39:21+02:00
draft: true
---

I've been working on a correlation analysis tool for observability time series.
I've written some [code](https://codeberg.org/kpaschen/corrjoin) based on a [paper](https://dl.acm.org/doi/10.1145/3626722).
My system receives time series through the Prometheus remote write protocol, computes Pearson correlation coefficients on sliding time windows, and publishes the results in otel format. I have been looking at the results and experimenting with different ways of analysing and visualising them, but that will be a topic for a different blog post. Today, I just want to write about how to make sure my system gets a lot of interesting time series to process.

The paper authors tested their implementation with up to 5000 time series. They found it difficult to get their hands on large time series data sets; I had no idea that was a problem for people, so this blog post is also a pointer for them---here is how you can generate a lot of time series data, programmatically!

### Why does correlation matter?

Consider the various metrics that show a container's memory usage. The picture below shows three of them, all for the
same container. I have chosen `container_memory_rss`, `container_memory_working_set_bytes` and
`container_memory_usage_bytes`. These all come from cAdvisor and they measure slightly different things,
 but for a lot of applications, they will 
move mostly parallel to each other. The algorithm I implemented will find that they are strongly correlated
with each other.

<img src="../../../images/memoryts-dark.jpg"
 alt="Three time series recording memory usage of the same container"
/>

There are many reasons why time series are correlated. Some of them measure the same underlying phenomenon; some
measure different things, but the things they measure are related to each other. For example, the memory usage of
a web application may be correlated with the number of incoming requests. That's a direct causal relationship. 
Sometimes, time series are correlated because they are related to a common underlying cause. This is the case
with the memory metrics here. 

```
container_memory_rss = total_rss

container_memory_usage_bytes = total_rss + total_cache + some overhead

container_memory_working_set_bytes = container_memory_usage_bytes - total_inactive_file
```

You can use the information that two time series are usually correlated to derive information about
systems interactions. This can be useful in poorly documented or very complex systems.

The other interesting insight you can get from correlation analysis is when time correlations start or stop.
For example, when `container_memory_rss` and `container_memory_working_set_bytes` stop being correlated,
usually some i/o is happening: the main difference between these two metrics is that the working set includes
the active file cache, and rss doesn't. 

### Why do I need a lot of time series?

The algorithm takes the values of time series within a time window, normalizes them, and then applies some quick checks to identify pairs of time series
that might be correlated. It computes the Pearson coefficient on those pairs. The overall speed of the system depends mainly on the number of these
 pairs. I want to stress test my implementation to make sure it can deal with large Kubernetes clusters, which can have hundreds of thousands or even millions of time series; the easiest way to do this would be to set up such a cluster, but they are expensive to run. The second best way is to create realistic test data.

It is easy to create time series; just write a service that exports as many metrics as you want and get Prometheus to scrape it; or write a bunch of PromQL rules to generate more data from your existing time series. If you're mainly concerned with stress testing ingestion or storage, this is very good, but the correlation algorithm does not get stressed by random or constant time series; I need data that reflects more closely what happens in a real cluster. How do I get that, without the expense of actually running such a cluster?

### What makes a time series interesting?

When you look at the correlations between time series in a Kubernetes cluster, you'll see a huge set of time series that are all correlated.
These are the constant time series.
My sample Kind cluster has about 40k time series, and about 20k of them are constant. This goes up to 30k if I just leave the cluster idle.
There are good reasons for a time series to be constant in a time window; a common one is that whatever the time series is measuring isn't happening right now. For example, the time series might be a counter of the number of times a node has experienced disk pressure. Most of the time, this counter is constant, but when it isn't, you will want to know, so it makes sense for the time series to exist. 
 
All constant time series have a Pearson correlation coefficient of 1, but this is not interesting. Luckily, it is easy and cheap to detect that a time series has constant values within a given time window, so my implementation does that. This saves a lot of computational effort.

After this filtering, you will have a second large set of correlated time series, maybe 6-8k in size. These are what I call the "steady counters". They are time series that represent a count of something that increases regularly, like a heartbeat. Most of these are correlated with each other most of the time, either because they count things that are related, or because they count things that occur with the same frequency. Luckily, this set is also easy to identify and skip.

Next, some pairs of correlated time series have identical values. There's a few ways these can come about; some time series just represent the same value, maybe because you imported PromQL rule sets from different sources and two of them had rules for the same thing, but with different names. Sometimes there are several ways of measuring something that will almost always yield identical results. And some time series are only mostly the same; they diverge in some circumstances (memory usage metrics do this, for example). When two time series have identical values in a time window, they are correlated, but we do not need to compute a Pearson coefficient to show this.

We've now got three examples of time series behaviour (constantness, counter-like behaviour, and identical values) that are relatively easy to detect. The academic paper introducing the correlation join algorithm did not discuss these cases, probably because the researchers did not expect them to be common. But given how common they are in practice, it makes sense to adapt the implementation, because this avoids a lot of unnecessary computation.

The correlation join algorithm is designed to avoid computing the correlation coefficient for time series that are obviously not correlated. The tweaks outlined here avoid computing the correlation coefficient for pairs of time series that are trivially correlated.
In order to really stress the implementation, we need to feed it time series that need their correlation coefficient computed even with these optimizations. So they must be correlated or nearly correlated, but not identical. Most simple ways of generating time series data will not create sufficiently difficult data sets.

### But couldn't we test it on boring data?

We could turn off some or all of our optimisations during tests. Maybe that would allow us to perform a useful stress test even with insufficiently complex test data. However, doing so affects the distribution of sizes of internal data structures. This is because the constant and the counter time series sets give rise to very large sets of correlated time series. Such sets are atypical otherwise. So turning off our optimizations would get the implementation stressed even on non-complex test data, but the stress would be different from what we could expect from an increase in complex time series.

Moreover, it seems a little weird to benchmark the code with different settings than what I'd recommend in production.

### Even more interesting data

Some correlations (arguably the most interesting ones) only appear or disappear when something unusual happens in the cluster. For example, the latency of my VictoriaMetrics database becomes correlated with disk i/o when there are a lot of inserts. Correlations that appear or disappear when the cluster is under some kind of stress are common. This makes sense when I consider the motivation behind observability metrics: some are the basis for alerting or troubleshooting, so it makes sense that they measure stress; either stress on an entire software system or on a part of it. Because the parts of a software system interact with each other, stress metrics on one part often means there's also stress on other parts, which we might detect as correlation.

For my test data, this means that it needs to reflect an interconnected system, and I should include some data that shows the system under stress.

So, how do I get or create useful test data?

### Approach 1: Monitor all the things

Even in a Kubernetes cluster with just three or four nodes, you can run a lot of services. Many commonly used services come with helm charts that make them easy to install, and most export Prometheus metrics. The hard part is running simulated traffic through these services, since otherwise most of their time series will be constant. I have done some of this, mainly because I already had a Mattermost+Postgres+Apache setup ready to go and Mattermost have a decent automated load test generator. Unfortunately, the Mattermost team only enable the metrics endpoint for the enterprise license, which is outside my price range, but Postgres and Apache are good sources of time series. This gets me to maybe 60k time series. Apache Kafka, if you use a metrics exporter that sets up separate time series per topic, is also a very good source of time series.

I introduce stress into the system by running the `stress` tool in an extra pod; this consumes extra cpu or memory. As a more extreme measure, I can restart a pod or node.

I could continue along these lines and basically set up a mockup of an enterprise software landscape, with Keycloak and Vault and Consul and whatever other middleware I can think of, and some random little web service in the middle that relies on all of them. This gets really unwieldy to set up though, and it might be overkill for a stress test.

### Approach 2: Synthetic time series

Once I have some reasonable time series, I can create more via copying and distorting. A straight up copy would be detected by the "identical time series" filter, but modifying the time series values just a little can work. 




