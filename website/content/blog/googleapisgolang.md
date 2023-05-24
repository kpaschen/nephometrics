---
title: "Mapping your Cloud Assets using Google's APIs in Go"
date: 2021-02-11T16:35:53+01:00
draft: false
tags: ["gcloud", "gcloud api", "golang"]
---
If you've used Google's Cloud, you've probably encountered their commandline tool. While you can achieve many things using just the
[web cloud console](https://console.cloud.google.com/), the `gcloud` command line
tool is flexible, scriptable, and (once you know how to use it), quicker
than the console.

For automation beyond a quick script, Google offer
[APIs](https://github.com/googleapis/) in several programming languages.
 The client libraries for these APIs are generated automatically, so you
get the same feature set no matter which of the supported languages you choose.

I recently wanted to explore the different machine types and their costs and
I used several of the golang client APIs for this purpose (everything
relevant is in the documentation, I just wanted to try the APIs really).

One of the challenges in using the Google APIs is that there are a lot of them,
and I do not always know right away which one has the information I want. For
a list of available machine types, you need the
[Compute API](https://github.com/googleapis/google-api-go-client/tree/master/compute). The generated code is so large that it's easier to download the file
from github than to browse it there.

There is a [Getting Started](https://github.com/googleapis/google-api-go-client/blob/master/GettingStarted.md) file, and most of the APIs also have an
example page. Moreover, there is documentation about the APIs in general
at [cloud.google.com](https://cloud.google.com/apis/docs/overview) and you
can follow links from there to language- or API-specific documentation.

 However, I ran into a few things that weren't in these guides,
so I thought I'd write them down here.

### Authentication

The Google API documentation always starts with several options for authentication.
I just create a service account, give it a minimal set of roles (for the 
examples here, `Compute Viewer` and `Monitoring Viewer` are enough),
download a credentials `.json` file for it, and then run

<pre class="chroma">
<code style="white-space: nowrap;">
export GOOGLE_APPLICATION_CREDENTIALS=./whatever.json
</code>
</pre>

But if you want to go another route, this part of the API is absolutely
thoroughly documented.

### API Flavours and Versions

The golang APIs come in two flavours. The documentation for one flavour ("Google APIs Client Libraries")
lives under [google.golang.org](https://pkg.go.dev/google.golang.org/) and
the other one ("Cloud Client Libraries for Go") lives under [cloud.google.com/go](https://pkg.go.dev/cloud.google.com/go/).

As the name implies, the Cloud Client Libraries for Go focus on the cloud platform
APIs. The Google APIs Client Libraries cover more APIs, and with a slightly
different syntax, but the documentation says the cloud client libraries are
"more idiomatic". I'll call these two flavours the "Cloud" vs. "API" flavours
below.

So, hey, I'll try both.

Besides the flavours, the APIs are also versioned, A few features may only
be available in a `beta` version or similar. For the compute service, I'll
only be using `v1` features here.

Both flavours offer functions that

  * list all items of a given kind (e.g. machine types or VM instances)
  * retrieve a particular item given its id
 
Depending on the API, you may also be able to create new items or modify
existing ones, but I am only looking at retrieval for now.

### Google APIs Client Library: compute/v1

Import the library like this:

{{< highlight golang >}}
import "google.golang.org/api/compute/v1"
{{< /highlight >}}

You will also need to import "context" and "fmt".

In order to find the functions and how to call them, I browsed the generated code for the compute API. It contains several service declarations.
One of them is `MachineTypesService`; I looked for functions declared on
this type, there is a `List` and a `Get` call. `List` takes a project ID
and a zone. I can see why you'd require a zone (not all machine types are
available in all zones), not sure about the project. All API calls I've
seen require a project ID as a parameter. Maybe this is about billing,
since there is a quota for how often you can call one of these APIs? But
the caller already has to use authentication, which has to be tied to
a Billing Account at least. Maybe it's because a project or a user
can have access to pre-release features enabled and that might add
machine types to the lists you can get? That's possible, but it's also
possible this is just because the APIs work on a heavily denormalised
data model where the project ID is the root of all the data you can
request. The format of the URI ids bears this out -- if you print assets
retrieved from the Assets or Compute APIs, you'll get something like this:

{{< highlight bash >}}
Name://compute.googleapis.com/projects/binderhub-test-275512/zones/europe-west1-b/instances/binderhub-minikube
{{< /highlight >}}

This is for an Instance, but Disks and so on have similar patterns. Here there
is the project ID, followed by the zone, then the asset type, and then the
actual name that I gave the instance when I created it (if you wonder about the
name, this is a VM I use when I want to run the minikube-based unit tests
for binderhub, because I dislike running minikube on my own computer).

The machine type for that instance is:

{{< highlight bash >}}
https://www.googleapis.com/compute/v1/projects/binderhub-test-275512/zones/europe-west1-b/machineTypes/n1-standard-2
{{< /highlight >}}

so if I assume that these paths reflect how the data is laid out internally
at Google, then that suggests a very denormalised schema with the project ID
as primary key for everything of interest to the project.

It would have been nice to be able to get a generic list of machine types
and then have a separate call that lets me know which type is available
in which zone, but I'll take what I can get. You can actually get lists
of Regions and Zones from the Compute API if you want to get all the
machine type/zone combinations.

In order to call an API (API flavour), here is what I do:

{{< highlight golang >}}
func ListMachineTypes(project string, zone string) error {
  ctx := context.Background()
  client, err := compute.NewService(ctx)
  if err != nil {
    return err
  }
  const pageSize int64 = 100
  resp, err := client.MachineTypes.List(project, zone)
                     .MaxResults(pageSize).Do()
  if err != nil {
    return err
  }
  for _, machineType := range resp.Items {
    fmt.Printf("Found a machine type: %+v\n",
               machineType)
  }
  return nil
}
{{< /highlight >}}

About the `pageSize` constant: the API can return paginated results,
which is useful when there are a lot of them. Machine types are not so bad,
but if you query the Monitoring API for metrics, you can get a lot.

With code like the above, you will only get the first 100 results. If you want
all of them, you need to look at the `pageToken` contained in the response.

{{< highlight golang >}}
func ListMachineTypes(project string, zone string) error {
  ctx := context.Background()
  client, err := compute.NewService(ctx)
  if err != nil {
    return err
  }
  const pageSize int64 = 100
  nextPageToken := ""
  for {
    resp, err := client.MachineTypes.List(
                        project, zone)
	               .MaxResults(pageSize)
	               .PageToken(nextPageToken)
		       .Do()
    if err != nil {
      return err
    }
    for _, machineType := range resp.Items {
      fmt.Printf("Found a machine type: %+v\n",
		 machineType)
      }
      if resp.NextPageToken == "" {
        break
      }
      nextPageToken = resp.NextPageToken
  }
  return nil
}
{{< /highlight >}}

The generated code lets you see the return types for all API calls.
They are protocol buffers (of course). The documentation in the code
is quite good, but you can also just print some or all of the items
you get back (as in the example above) to see what they look like.
With machine types, the number of cpus is in a field called `GuestCpus`
and the max memory per VM is expressed in Mb. You don't really get to see
the number of GPUs available (at least not that I could find), but you
can look at the `Accelerators` field; moreover, for the machine types
that offer GPUs (currently only the `a2-` series), you can look at the
type name. Normally, when a machine type name ends in a number (like
`n1-standard-2`) that number is the number of vCPUs. With the `a2-` series,
the type names end in a number followed by `g`, and that number is the
number of GPUs.

Several settings besides the machine type influence the performance
 (and cost) of your VMs, for example the usage type (`Preemptible` is cheap
but, well, preemptible). You can get these settings either via the
`assets` API (which gets you a list of all the assets in use by a given
project) or via the `compute` API (where you can retrieve all assets of
a particular type, such as `Instance`, for a project).

You also don't have to be running your instances all the time; the assets
API will report the status of an instance as e.g. `TERMINATED` if you have
stopped it. A stopped instance incurs no costs (you still pay for persistent
 disk space and things such as disk images, but not for the VM).

So another thing I want to know about my VMs is, how much do I use them?
I couldn't see a way to figure this out other than via monitoring. For this
part, I used the Cloud flavour of the APIs.

### Cloud Client Libraries: Monitoring

The Cloud flavour is quite similar to the API flavour---you still
do the same things (request data, use page tokens to go through the
list), but the syntax is just different enough to need reading up on.

First off, there are more things you need to import.

<pre class="chroma">
<code style="white-space: nowrap;">
  "cloud.google.com/go/monitoring/apiv3"
</code>
<code style="white-space: nowrap;">
  "google.golang.org/api/iterator"
</code>
<code style="white-space: nowrap;">
  pb "google.golang.org/genproto/googleapis/monitoring/v3"
</code>
</pre>

And then instead of a fairly generic `NewService` you have to specify which
service you want a client for. I found what I needed by reading the
generated source code on github.

Below, I have omitted some error handling just to keep the code shorter.
I also hardcoded the metric and resource type parameters. I found these
parameters via the Metrics Explorer; you can obtain lists via the monitoring
API, but there are a lot of metrics and resource types to scroll through.

{{< highlight golang >}}
func GetMetricDescriptors(project string) error {
  ctx := context.Background()
  client, _ := monitoring.NewMetricClient(ctx)
  nextPageToken := ""
  filter := fmt.Sprintf(`metric.type=starts_with("%s")
	AND resource.type=starts_with("%s")`,
	"gce_instance",
	"compute.googleapis.com/instance/uptime")
  for {
    req := &pb.ListMetricDescriptorsRequest{
	Name: project,
	Filter: filter,
	PageSize: 100,
	PageToken: nextPageToken,
    }
    it := client.ListMetricDescriptors(ctx, req)
    for {
      resp, err := it.Next()
      if err == iterator.Done() {
        break
      }
      if err != nil {
        return err
      }
      fmt.Printf("response: %+v\n", resp)
      if it.PageInfo().Token == "" {
        break
      }
      nextPageToken = it.PageInfo().Token
    }	 
  }
  return nil
}
{{< /highlight >}}

This finds two metrics, `uptime` and `uptime_total` because of the
`starts_with` clause in the Filter. It retrieves metadata about these
metrics. It looks like this (I added linebreaks to make it more readable):

{{< highlight json >}}
name:"projects/binderhub-test-275512/metricDescriptors/compute.googleapis.com/instance/uptime"
type:"compute.googleapis.com/instance/uptime"
labels:{key:"instance_name"  description:"The name of the VM instance."}
metric_kind:DELTA
value_type:DOUBLE
unit:"s{uptime}"
description:"Delta of how long the VM has been running, in seconds. Note: to get the total number of seconds since VM start, use compute.googleapis.com/instance/uptime_total."
display_name:"Uptime"
metadata:{launch_stage:GA  sample_period:{seconds:60}  ingest_delay:{seconds:240}}
launch_stage:GA
monitored_resource_types:"gce_instance"
{{< /highlight >}}

I don't know that this is actually the best way to obtain the uptime of a VM
from Stackdriver. I was hoping for something like the `up` timeseries that Prometheus
gets your for jobs and then a way to use something like Prometheus' `count_over_time`.

In order to get the actual uptime for my VMs over a time period, I'll need
to request a time series. The monitoring API has the `ListTimeSeries` call for this
purpose. It takes a `ListTimeSeriesRequest`, which has to specify a filter
(for specifying the metrics to use) as well as a `TimeInterval` protocol
buffer and an `Aggregation`.

The function is, somewhat confusingly, called `ListTimeSeries` rather than
 `GetTimeSeries`.
The call actually fails if your filter matches more than one
metric. Depending on your aggregation settings, you can still get more than
one time series, but they'll all be for the same metric, just with different
label combinations.

Below are some code snippets for how to fill in the request.
For the aggregation settings, I cheated (just a bit) and fiddled with
the Metrics Explorer until I had data that looked useful, then fished
likely-looking parameters out of the URL.

`mpb` is for the monitoringpb module. You will also need to import
durationpb and timestamppb.

{{< highlight golang >}}
// Set up a TimeInterval for the past day (86400 seconds)
now := time.Now().Unix()
interval := &mb.TimeInterval{
             EndTime: &timestamppb.Timestamp{
               Seconds: now,
             },
             StartTime: &timestamppb.Timestamp{
               Seconds: now - 86400,
             },
}

// Create filter based on metric type and resource type
filter := fmt.Sprintf(
  `metric.type="%s" AND
   resource.type="%s"`,
   "gce_instance", "uptime_total")

groupBy := "metric.system_labels.region"

// Make the request proto
req := &mpb.ListTimeSeriesRequest{
  Name:     projectID,
  Filter:   filter,
  Interval: interval,
  View:     mpb.ListTimeSeriesRequest_FULL,
  Aggregation: &mpb.Aggregation{
   CrossSeriesReducer: mpb.Aggregation_REDUCE_SUM,
   PerSeriesAligner: mpb.Aggregation_ALIGN_MEAN,
   AlignmentPeriod: &durationpb.Duration{ Seconds: 600 },
   GroupByFields: []string{groupBy},
  },
}

// Send the request:
it := client.ListTimeSeries(ctx, req)

{{< /highlight >}}

The time series request is quite difficult to fill in correctly,
especially if you use aggregation (and you usually have to aggregate
somehow). I played with the Metrics Explorer to
work out which values to set in the aggregation proto.

I used `uptime_total` rather than `uptime` here. `uptime_total` is the
total elapsed time since the VM was started, in seconds. `uptime` is a delta.
I requested a sum of time series grouped by region. This means I get one
time series per region, and the values in each series are sums of the `uptime_total` values for the VMs in that region.

I ran this using just a single VM in one region, and a time range of
one week. I had the VM running for a while one day, then took it down,
then ran it again for about 11 minutes. Here is the time series I got back:

{{< highlight json >}}
metric:{type:"compute.googleapis.com/instance/uptime_total"
        labels:{key:"instance_name" value:"instance-1"}}
resource:{type:"gce_instance"
labels:{key:"project_id" value:"binderhub-test-275512"}}
metric_kind:GAUGE
value_type:DOUBLE
points:{
  interval:{
    end_time:{seconds:1613031278}
    start_time:{seconds:1613031278}}
    value:{double_value:444}
}
points:{
  interval:{
     end_time:{seconds:1613030678}
     start_time:{seconds:1613030678}}
     value:{double_value:90}
}
points:{
  interval:{
    end_time:{seconds:1612860878}
    start_time:{seconds:1612860878}}
    value:{double_value:1454.6666666666667}
}
points:{
  interval:{
    end_time:{seconds:1612860278}
    start_time:{seconds:1612860278}}
    value:{double_value:1050}
}
points:{
  interval:{
    end_time:{seconds:1612859678}
    start_time:{seconds:1612859678}}
    value:{double_value:450}
}
points:{
  interval:{
    end_time:{seconds:1612859078}
    start_time:{seconds:1612859078}}
    value:{double_value:60.333333333333336}
}
{{< /highlight >}}

The points in the time series are ordered from newest to oldest. The oldest
four points are from Feb 9th, the newest two from Feb 11th. Consecutive
measurements are 10 minutes apart (this matches the alignment period I
specified). The gap between the Feb 9th and Feb 11th points corresponds to
a time when the VM in question was stopped. For consecutive points, the
value always increases, so the last value for Feb 9th represents how long
the VM had been running when I stopped it, and then uptime_total resumed
from 0 when I restarted the VM on the 11th.

This means the total time
I had the VM running was 1454.667 seconds (about 24 minutes) on Feb 9th and
 444 seconds (7.4 minutes) on Feb 11th. However, because of the long
alignment period (10 minutes), the numbers are not precise. Indeed, the
Metrics Explorer claims 12.53m on the 9th and 6.42m on the 11th, and
the billing dashboard wants to charge me for 0.41 hours (about 24.6 minutes)
of VM running time on Feb 9th.

My monitoring-based estimate of VM uptime matches the one in the billing
dashboard, but at this point, I suspect this may be accidental. I don't
know how exactly Google determine usage for the purposes of billing; given
the overall awkwardness of aggregating and interpreting the data via the
monitoring API, I strongly suspect they use something else. I would
expect to be able to get a roughly correct estimate of my usage via monitoring,
but clearly this requires further research.


### Comparison

The GCloud client libraries are said to be more idiomatic than the other
flavour. I'm no great Go expert, so I cannot really tell. I found the
first flavour I wrote about (the Client APIs one) easier to use because you don't
need to import an extra protocol buffer and the iterator module.

The syntax for specifying the request in the API flavour

{{< highlight golang >}}
  resp, err := client.MachineTypes.List(project, zone)
	.MaxResults(pageSize)
	.PageToken(nextPageToken)
	.Do()
{{< /highlight >}}

feels a little Java-y compared to the Cloud flavour:

{{< highlight golang >}}
  req := &pb.ListMetricDescriptorsRequest{
	Name: project,
	Filter: filter,
	PageSize: 100,
	PageToken: nextPageToken,
  }
{{< /highlight >}}

On the other hand the API flavour has this:

{{< highlight golang >}}
  for _, machineType := range resp.Items
{{< /highlight >}}

compared to the explicit iterator syntax in the GCloud flavour, and I
find the first more natural in Go.

On the whole though, I don't particularly mind which flavour I use; I am glad
that there are comprehensive APIs at all.  However, I wish
the APIs were a little more interoperable. For example, the monitoring
API's filter syntax uses `resource_type="gce_instance"` whereas the assets
API uses `AssetType:compute.googleapis.com/Instance`. This makes it necessary
to hardcode mappings ("when I want to get metrics for an asset of type
`X` I need to ask for a resource of type `Y` in monitoring").

Everything gets much more complicated once you
start looking into billing and try to map assets (or resources) to Skus.
But that will have to wait for another blog post or two.
