---
title: "Running Mattermost in AWS: How much will it cost?"
date: 2023-05-09T11:55:04+01:00
draft: false
tags: ["mattermost", "aws", "resources", "cost"]
---

This post summarises results of an internship project that [Quang Cao](https://github.com/Quangcaow) completed February 2023.

### Summary

Mattermost is a chat service similar to Slack, but it allows customers to self-host their instance. This is nice if you have, e.g. data residency concerns; moreover, the basic version is [free](https://mattermost.com/pricing/). To be clear, *free* refers to the licensing costs, not the hosting.

You can get a hosted instance from mattermost.com or various SaaS providers. Prices vary,
but typically start around $20/month.
But let's say you want to do your own hosting---how much will this cost for a modestly sized team? We ran some experiments to determine the hardware you'll need and how much that will cost.

Of course, self-hosting has an additional cost besides the hardware, and that is the system administration effort
you'll have to spend. We have not put a number on that.

Quang ran performance tests on different configurations in AWS and determined that:

* For small teams, Mattermost will perform adequately on a `t2.micro` instance, and the complete setup will (at the time of writing) come to about $10 per month.
* You can scale up horizontally with more `t2.micro` instances for an additional $10 per month per instance.
* If you scale up vertically by switching to a `t2.small` instance you're looking at about $20 per month,
or $30 if you go to `t2.medium`.

In each case, you can save money by using reserved instances.

Much will vary depending on how active your users are and several choices that you make in AWS. And of course, other hosting providers are available, and offer similarly sized and priced VMs.


### Environment

There are excellent tutorials out there for how to run your own Mattermost instance, and we won't replicate them here. In short, you'll need four pieces:

* a *reverse proxy*---the [installation instructions](https://docs.mattermost.com/guides/deployment.html#server-installation) favour Nginx, but Apache works as well.
* a database---PostGres or MySQL both work fine.
* the Mattermost server binary itself
* an S3-compatible object storage for large files (such as image uploads)

For storage space estimations,
we've assumed 5-25 MB per user per month, in line with the [scaling recommendations for medium-usage teams](https://docs.mattermost.com/install/software-hardware-requirements.html#scale-requirements)

Mattermost used to recommend that the server should run on a computer with at least two cores and 4 GB of RAM. More recently, [their website](https://mattermost.com/dowhload/) says 1 core and 2GB of RAM should be enough up to 1000 users. In
AWS EC2, that would be a `t2.small` instance; we tested mainly on `t2.micro`, which have 1vCPU and
one GB of RAM ([overview](https://aws.amazon.com/ec2/instance-types/t2/))

We decided against using a managed database service such as RDS and instead installed Postgres in EC2.

We did not include voice or video calls in our experiments.

### Load tests

Let's say we have a certain number of people using our server: they read and write messages; sometimes they search for something, subscribe to a channel, unsubscribe from another one. Every now and then someone logs on or off. They might be using Mattermost via a browser or an app but independently of their client, all their actions will be implemented via calls
against the Mattermost server's REST API. We want to size our deployment so that for these users, the system shows acceptable latency and
reliability; that is, API requests are not very slow, and API requests only very rarely fail due to overload. We used Mattermost from the browser while various load tests were running and concluded that a latency of about 50ms (measured from nginx to the server) and a request failure rate below 1% would be acceptable.

Mattermost have their own [load-testing tool](https://github.com/mattermost/mattermost-load-test-ng) which lets you run a configurable mix of API requests against a server. The tool usually combines with a Prometheus instance for monitoring, but the metrics endpoint of
the Mattermost server is only enabled when you buy an Enterprise license. This would have cost us several thousand USD and that seemed a bit much for a relatively simple experiment. We were primarily interested in the failure rate and the end-user latency of API calls, and that information
can be obtained from the Nginx or Apache logs. On AWS, we extracted this information using CloudWatch logs.

A lot of Mattermost's client-server interaction is asynchronous: the client will periodically check for new messages. Users will rarely notice if those requests are slow. We looked up which API requests correspond to which interactions, and focused the latency evaluations on those requests where latency would be the most annoying to users.

We ran load tests for different numbers of users (30, 50, 200, 300) and using different hardware configurations:

   1. Everything (database, proxy, mattermost) on one t2.micro instance
   1. Two t2.micro instances for mattermost, one of them also hosting the database and reverse proxy
   1. Everything on one t2.medium instance


We ran the loadtesting tool on a separate VM in AWS, but it was in the same availability zone as our Mattermost server. Moreover, we measured latency at the reverse proxy. For some tests, this was on the same VM as the Mattermost server; for others, it was on a different VM but still in the same AZ. This is why we measured some very low latencies---there is almost no network latency included.

### Load test evaluation

The documentation and [publications](https://mattermost.com/blog/performance-scale-mattermost/) by the Mattermost team show that their load-testing tool evaluates performance under very high load.
They set out to show that their tool could scale up to thousands or even tens of thousands of simultaneous users.

We were asking a different question, namely, how small a setup is sufficient for a modest number of users. We deliberately ran
Mattermost on setups that were small and observed when and how performance degraded.

Below, when we mention a number of users, this is just a way to specify the size of the load test.
The load testing tool uses a configuration file where you can specify several parameters such as 
the number of simulated users and the mix of operations they perform. With the configuration we used
(pretty much the default one), every simulated user sends on average about five requests per minute.
That is more than most real users will do.

We do not know which settings the Mattermost team used
to determine that a t2.small instance is large enough for 1000 users, but our configuration
would not run 1000 simulated users even on a t2.medium. That is almost certainly because our configuration
simulates unrealistically active users.

A few more observations:

1.  It is important to run the loadtesting tool for long enough. It starts by creating users, logging them in and joining them to teams
and channels. This creates an initial flurry of activity and high load on the mattermost server, which subsides when the load test starts
sending the actual simulated requests. We always ran for at least one hour.
1.  Not all t2.micro instances are created equal. We observed differences in performance but were unable to determine
for sure whether these were due to differences in the underlying hardware. If you're unlucky, a t2.micro instance can reach high CPU
load (85-100%) and even crash during a load test. We saw this happen with as few as 50 users.
1.  At high load (starting at 50 users for t2.micro or 250 for t2.medium), some requests from the load test driver will time out. You don't always see these in the logs of the reverse proxy, but you can see them in the logs that the load test driver writes.
1.  With an earlier version of Mattermost (7.1.2), we observed a number of websocket timeouts especially under load. More recent versions (we tested up to 7.10.0) appear to have fixed this.

#### Evaluation

We ran load tests from a separate t2.micro AWS instance in the same availability zone as our mattermost servers.

The loadtesting tool uses a configuration file where you can specify the type of simulation as well as several parameters (number
of teams to create, frequency of different types of operations, etc.) For the results below, we used the default settings
of the load testing tool. We started it like this:

```
go run ./cmd/ltagent -n 50 -d 3600 > ltagent-50-3600 &
```

This runs a load test with 50 simulated users for one hour.

We used cloudwatch to extract latency and success/failure statistics from the logs of the reverse proxy. In addition, we examined
the log outputs from the load testing tool, and we looked at AWS monitoring for the CPU load of the mattermost instances.

This gives us the following data points:

1. Did this load make Mattermost crash on at least one of our test runs?
1. Highest CPU load observed on the Mattermost instances.
1. Number of load test requests that timed out (this comes from the load test agent log file)
1. Server errors (5xx responses) as percentage of total requests (from the reverse proxy logs)
1. Latency of requests by request method (GET, POST, PUT)
We also broke down the request latency by api endpoint because some request latencies are a lot more noticeable to the end user than others, but the breakdown by method is a good way to get a first idea of whether a given setup is workable at all.

### Load test evaluation

| Setup         | Users           | Crash? | CPU load | Timeouts | Server error ratio | GET latency | POST latency |
|         :---: | ---:            | ---:   | ---:     | ---:     | ---:               | ---:        | ---:         |
| t2.micro      |              30 |     N  |        6%|        0 |              0.6%  |       4.1ms |       31.9ms |
| t2.micro      |              50 |     Y  |       10%|        0 |              0.5%  |       2.5ms |       30.0ms |
| t2.micro      |             200 |     Y  |       85%|       50 |              0.4%  |      10.4ms |      162.0ms |
| t2.micro      |             250 |     Y  |       50%|       80 |              0.4%  |      18.1ms |      218.5ms |
| t2.micro      |             300 |     Y  |      100%|     lots |              1.0%  |    1842.5ms |    64574.9ms |
| t2.micro dual |              50 |     N  |       10%|        0 |              0.5%  |       4.9ms |       23.8ms |
| t2.micro dual |             200 |     N  |       11%|        0 |              0.1%  |       3.1ms |       38.3ms |
| t2.micro dual |             300 |     N  |       13%|        0 |              3.0%  |       4.6ms |       31.2ms |
| t2.medium     |              50 |     N  |        7%|        0 |              0.5%  |       1.9ms |       17.6ms |
| t2.medium     |             200 |     N  |       11%|        0 |              0.5%  |       2.2ms |       17.5ms |
| t2.medium     |             300 |     N  |       11%|      124 |              0.4%  |       4.7ms |       88.7ms |
| t2.medium     |             500 |     Y  |       96%|     lots |                    |             |              |

#### Everything on one t2.micro instance

In this setup, we deployed the reverse proxy, the database, and the mattermost service on one t2.micro instance (1 CPU, 1 GB RAM). This is below the minimum size recommended by Mattermost.

Surprisingly enough, this setup is usable at 30 users. At 50 users, it crashed a few times, and ran fine other times. Timeouts consistently
showed up at 200 users, and latency was high at 200 users as well.

#### Two t2.micro instances for mattermost

Mattermost has multi-instance support. We ran two mattermost servers behind one Apache reverse proxy. This means we had two t2.micro
instances in total, one hosting the reverse proxy, the database and one mattermost server, and the other hosting the second mattermost server.

At the loads we were using, the cpu load for the database and the reverse proxy were not high, otherwise we could have split them off
into a third t2.micro instance.

This setup can handle 50 users with no problems. You can see the latency beginning to creep up at 200 users, and then server errors
increasing at 300 users.

#### Everything on one t2.medium instance

Performance was good at 50-200 users, with a marked increase in latency at 300 accompanied by timeouts. We tried it once with 500 users
and it crashed, and since latency was already high at 300, this did not seem worth trying again.

### Cost estimation

Our deployment's costs are dominated by the cost of the VM(s).

We'll assume that an average user produces 5-25MB per month that gets stored in the DB, and that we do not prune data from the database; this gives us a total of about 180 MB per user and year. We'll also assume 1 GB per user and year of S3.

Inbound data transfer from the internet to AWS is free, but we do have to pay for outbound. This is 0.09 USD per GB and month.

If we assume that every user creates about 15 MB per month and that all users see everybody else's messages, then 15 * number of users MB of outgoing traffic per month is a lower bound. We have to assume some messages or images are viewed multiple times. Still, at 0.09 USD per GB, this should not be a huge item on our bill.

We'll want an external IP for our service, but one is enough, and that is free. Since we only have the one instance, there is no load balancer. I'll assume you already have a domain name, otherwise budget about 10 USD/year for an inexpensive one.

At 30 users, we'll pay 

* 0.09 USD for outbound network traffic
* 0.60 USD for EBS storage
* 9.78 USD for one t2.micro instance (this goes down to 5.11 with an EC2 instance savings plan)
* 0.08 USD for S3

If we wanted to go for a larger VM, a t2.medium (2 CPUs, 4 GB RAM) is USD 20.15/month on the cheapest savings plan. An a1.large is at least USD 36.72 per month but before paying that, it would be worth looking at using a dynamically scaled number of smaller instances.

For comparison, we could get a similar setup on [Infomaniak](https://infomaniak.com), where a VM the size of a t2.small instance will
cost CHF 4.67/month, but the public IP will set us back CHF 3.34/month. 

### Conclusion

If you want to host Mattermost yourself, and find yourself wondering how much it will cost you, maybe
these results can help you. It is difficult to say exactly how much you will need, but here is some
guidance for the hardware you can start with, as well as for metrics you'll want to keep an eye on. 

In summary, you can't really get started with self-hosting for anything less than about 10$ per month.

If you start with a very small deployment, you'll want to keep an eye on performance to make sure
you scale up when it is necessary; CPU load is one indicator here, but the data above shows that
the average latency of POST requests will allow you to spot overload earlier. If it goes over
40ms (measured from the reverse proxy to the Mattermost instance), there is a good chance your
Mattermost server is overloaded.

