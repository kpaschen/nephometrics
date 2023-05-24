---
title: "SKUs and Resources"
date: 2021-03-18T13:46:20+01:00
draft: false
tags: ["resource estimation", "gcloud", "billing", "SKU", "matching SKUs to resources", "cloud billing"]
---

Reading cloud bills is hard.
For illustration, below are a few lines from the bill for a small toy project of mine on GCloud. I don't want to
single Google out here---AWS and Azure bills are also difficult to read. In the following, all details are taken from
Google Cloud, but I point to related AWS or Azure features when I think it's useful.

 Some of the trouble with reading the bill comes from how the resources
I have (such as virtual machines) translate to the entities that the provider bills me for.

<table>
<thead>
<tr style="background:white;">
<th align="left">SKU</th><th align="left">SKU ID</th><th align="left">Usage</th><th align="right">Cost in CHF</th>
</tr>
</thead>
<tbody>
<tr>
<td align="left">Storage PD Capacity</td><td align="left">D973-5D65-BAB2</td><td align="left">51.24 gibibyte month</td><td align="right">0.77</td>
</tr>
<tr style="background-color:#fbf2f9;">
<td align="left">Storage PD Capacity in Netherlands</td><td align="left">AE8C-46C3-4994</td><td align="left">2.94 gibibyte month</td><td align="right">0.12</td>
</tr>
<tr>
<td align="left">N1 Predefined Instance Core running in EMEA</td><td align="left">9431-52B1-2C4F</td><td align="left">2.67 hour</td><td align="right">0.08</td>
</tr>
<tr style="background-color:#fbf2f9;">
<td align="left">N1 Predefined Instance Ram running in EMEA</td><td align="left">39F4-0112-6F39</td><td align="left">10.01 gibibyte hour</td><td align="right">0.04</td>
</tr>
</tbody>
</table>

This only shows the first few lines out of a total of 61.

I'll go over what the entries mean next, starting with the meaning of "SKU". Then comes a bit about how to labels
or tags can make this bill more meaningful, and at the end I'll use all this information to try and solve a little mystery.

### What is a SKU?

_SKU_ stands for _Stock Keeping Unit_ (at least that's what I found on the Internet). AWS, Azure and Google all use
SKUs in their billing systems. I find it easiest to think of a SKU as a billing code---it identifies a category of things
that a cloud provider charges me for. These categories are very fine-grained, they are
(of course) not consistent across cloud providers, and matching Resources to SKUs is not straightforward.

 I used a VM of the N1
[machine type](https://cloud.google.com/compute/docs/machine-types). The breakdown
shows costs incurred between Mar 1st and Mar 16th. The VM only ran for a few hours, and I got
billed by the hour. I use the N1 instance for running _minikube_ because sometimes I need
to run unit tests that use it and bringing up minikube on my personal computer is a pain in the neck.
Google has separate SKUs for CPU and Ram used by my N1 instance. For machine types that support them, there is
another SKU for GPUs.

For the storage costs, there are two disks (the _PD Capacity_ lines; _PD_ stands for _Persistent Disk_).
 One of them was a _zonal_ disk, the other
a _regional_ disk. I deleted the regional disk soon after creating it.
The zonal disk has existed since before Mar 1st and it has a size of 100GB. I am getting billed for _51.24 gibibyte month_,
which makes sense: using the disk for a full month would be 100 gibibytes, we're on the 16th, the
bill is based on a snapshot taken some time earlier this day, hence 51.24. Indeed, the bill for a full
month comes to 100 gibibyte. _Gibibyte_ is an extra piece of precision here---often, when specifying data volumes, people
use _Gigabyte_ as shorthand for "1000 or 1024 Megabytes, not sure and don't care which". In billing, the distinction does
matter at some point (though not in this example).

Not shown but also interesting:

*  License costs for Ubuntu. These costs are always 0, they just show up on the bill breakdown, maybe for completeness' sake?
*  _External IP Charge on a Standard VM_---when you create a VM, by default you get an external IP associated with it. This is an _ephemeral_ IP address, it is released when you stop or destroy the VM. If you request a permanent (_static_) IP, there's a separate charge for that.
* There are a lot of separate lines for Network Ingress and Egress. My project has 0 usage for most of them, and some of them are either always free or have a very high free tier. At some point, I'll write a separate blog post about network billing, but it'll be lengthy.

Each of the assets (VM, Disk) I create for my project relates to one or more SKUs that I get billed for.
 Some assets, like the VM, imply
other assets (such as an address, a license, a boot disk). The SKUs reflect the
billing structure that Google applies to my assets, but lining up the assets as I see them and the SKUs that say how much
I pay for them is harder than it looks.

This is because:

* The same SKU will apply to multiple assets (for example, IP addresses).
* Some assets correspond to more than one SKU.

Experience helps in dealing with this, but so do labels (or tags if you're using AWS or Azure).

## Aligning your bill with your asset inventory via labels or tags.

The GCloud billing console lets you break down costs by Project, Service, or SKU.
_Service_ refers to the Google cloud service (like _Compute_ or _Kubernetes Engine_; the equivalents
for AWS would be _EC2_ or _EKS_), and I tend to scan costs service by service. Breaking down by SKU involves a lot of scrolling and clicking; I'd really like a category in between _service_ and _SKU_ here. Google also lets you filter by location
(region or zone) and by _label_. Labels are user-defined key-value pairs that you can attach to resources.

I'll focus on Google Cloud's
 [labels](https://cloud.google.com/resource-manager/docs/creating-managing-labels)
here.
 AWS has [cost allocation tags](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/cost-alloc-tags.html),
and Azure has [tags](https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/tag-support). Those are
all really cool and useful, but this post got long enough just writing about Google that AWS and Azure will have to wait for now.

The bottom-right corner of the billing console has a drop-down for label keys.
That drop-down is populated based on stackdriver monitoring time series that contain data with that label.
So what this means is, after you create a resource with a given label, you have to wait until there is monitoring data
for that resource, and then the label should show up in the drop-down. This way, you can get the console to show you costs for resources with a particular value for that label. When you do that, you can see that the label applies
to "dependent" resources as well---for example, I only labeled a VM, but the cost report for that label value also
shows costs for the IP address, network egress, and OS license.

This is nice, but if you want to do grouping by labels and see costs for several different label values at
once, I don't think there's a way to do that without [exporting to BigQuery](https://cloud.google.com/billing/docs/how-to/export-data-bigquery).
 AWS have a similar feature where you can export your bill
to S3 and then either view it there or import it into e.g. Athena. I haven't tried this with Azure yet, but
they have a pretty comprehensive [cost management toolset](https://docs.microsoft.com/en-us/azure/cost-management-billing/understand/download-azure-daily-usage).

As far as I know, labels do not apply to costs retroactively. Thus if you have a VM and label it halfway through the
month, I wouldn't rely on all the costs related to that VM for that month having the label.

## SKUs and prices

Once you have a SKU, you can look up how much you'll get charged. Google have a 
[SKU explorer](https://cloud.google.com/skus/?currency=USD&filter=9431-52B1-2C4F) that shows you the
description (_N1 Predefined Instance Core running in EMEA_), the price (0.034773 USD per hour) and the regions
(_europe-west1_ -- this means the description should really be "in Belgium" rather than "in EMEA", since
there are other SKUs for N1 Cores running in the Netherlands for example).

If you want to know more about your SKUs (and who wouldn't), Google's [billing APIs](https://cloud.google.com/billing/docs/apis) let you query SKUs programmatically.
 You do need to put a _SKU Service Name_ into the API request. You can see the service name in the _Cost table_ on the billing
console, but not in the _Cost breakdown_ page. 
Another way is to query the
SKU explorer for a SKU (for example one that showed up on your bill). The explorer shows the SKU
service name (6F81-5844-456A for _Compute Engine_ in this example) in the blue bar at the top of its results.
Compute Engine is one of the largest SKU services, and it contains a lot of the SKUs I care about in my work.

When you request a SKU via the API, you get back a protocol buffer including a field called [PricingExpression](
https://cloud.google.com/billing/docs/reference/rpc/google.cloud.billing.v1#google.cloud.billing.v1.PricingExpression).
 This encodes how the price is calculated. It's not super easy to read, but the documentation is good.

Amazon also offers an [API](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/using-ppslong.html)
 for obtaining price information. Theirs is arguably more convenient than Google's because you don't even need to be authenticated to use the bulk download. If you request pricing information for their compute service (`EC2`),
you'll get about a Gigabyte's worth of JSON or CSV (your choice). I find the entries a little difficult to interpret but this, too, will have to wait for another blog post.

Azure has a comparable [API](https://docs.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices) as well.

Ideally, I'd like to obtain SKUs (or price information, actually) based on the assets I've got. So I'd put an asset
specification into a request and ask an API for the SKUs that apply to this asset. As far as I know, Google does
not offer this as an API service (if they do, please let me know!).

## A Mystery Solved (Maybe)

Finally, let's put all this information together and solve a mystery.
On my Google Cloud bill, I have three charges for the Ubuntu OS license:

<table>
<thead>
<tr style="background:white;">
<th align="left">SKU</th><th align="left">SKU ID</th><th align="left">Usage</th><th align="right">Cost in CHF</th>
</tr>
</thead>
<tbody>
<tr>
<td align="left">Licensing Fee for Ubuntu 16.04 (Xenial Xerus) (CPU cost)</td><td align="left">2A23-096B-A372</td><td align="left">1.33 hour</td><td align="right">0.00</td>
</tr>
<tr style="background-color:#fbf2f9;">
<td align="left">Licensing Fee for Ubuntu 16.04 (Xenial Xerus) (CPU cost)</td><td align="left">EE6A-FFA3-84D7</td><td align="left">2.67 hour</td><td align="right">0.00</td>
</tr>
<tr>
<td align="left">Licensing Fee for Ubuntu 16.04 (Xenial Xerus) (RAM cost)</td><td align="left">9169-5341-635D</td><td align="left">10.01 gibibyte hour</td><td align="right">0.00</td>
</tr>
</tbody>
</table>

If the costs weren't all zero, I guess I'd be a little worried. Why are there two charges for "CPU cost"?
Browsing the SKUs did not get me additional information. Labels helped me verify that these charges are
indeed for the minikube VM (the other VM I run uses Debian). I also verified that I get the equivalent
three lines of charges for Debian and Fedora.

So next I compared the Usages reported: 1.33 vs. 2.67 hours for the CPU costs, and 10.01 gibibyte hours for
the RAM cost. The VM had had about 80 minutes of uptime, and that's close enough to 1.33 hours. An
N1-Standard-2 machine type has two vCPUs and eight GB of RAM. So maybe one of the "CPU cost" charges is
really a "VM cost" charge, because the VM ran for 1.33 hours. And the second "CPU cost" charge is per vCPU,
hence `2 * 1.33 ~ 2.67` hours. This matches the RAM charge: 10.01 gibibyte hours are about 10.75 Gigabyte hours,
and that's about `8 * 1.34` Gigabyte hours.

Maybe this means that Google supports billing for licenses based on RAM usage, vCPU usage, VM count, or 
a combination of those, and they simply created SKUs for all billing modes even though some of them always
have a zero price?

However, I could not find all of these SKUs in the [explorer](https://cloud.google.com/skus/?currency=USD&filter=F9BE-F344-D1B6).
 I have a SKU on my bill for March that's labeled
_Licensing Fee for Fedora CoreOS Stable (CPU cost)_ with an id of `F9BE-F344-D1B6` but the SKU explorer claims
that this SKU does not exist. Maybe there's some kind of migration or update in progress? Then again,
the API data and BigQuery both know about this SKU, so maybe it's the explorer that is wrong.

On another hand, SKUs for other OSses can be structured in very different ways.
For example, here are the SKUs for `RHEL7` licenses:

<table>
<thead>
<tr style="background:white;">
<th align="left">SKU</th><th align="left">Description</th>
</tr>
</thead>
<tbody>
<tr>
<td align="left">2894-5229-F604</td><td align="left">Licensing Fee for RedHat Enterprise Linux 7 (GPU cost)</td>
</tr>
<tr style="background-color:#fbf2f9;">
<td align="left">5744-6443-7F8D</td><td align="left">Licensing Fee for RedHat Enterprise Linux 7 on VM with 1 to 4 VCPU</td>
</tr>
<tr>
<td align="left">9AAA-D841-1CA1</td><td align="left">Licensing Fee for RedHat Enterprise Linux 7 on VM with 6 or more VCPU</td>
</tr>
<tr style="background-color:#fbf2f9;">
<td align="left">FF54-E5CA-BAC3</td><td align="left">Licensing Fee for RedHat Enterprise Linux 7 on f1-micro</td>
</tr>
<tr>
<td align="left">9AAA-D841-1CA1</td><td align="left">Licensing Fee for RedHat Enterprise Linux 7 on g1-small</td>
</tr>
<tr style="background-color:#fbf2f9;">
<td align="left">FF54-E5CA-BAC3</td><td align="left">Licensing Fee for RedHat Enterprise Linux 7 (RAM cost)</td>
</tr>
</tbody>
</table>

By the way, you can get this information out of BigQuery if you have set up billing exports for your account.

This probably shows that there are more ways for Google to implement licenses than just per-VM or per-vCPU,
so maybe the Ubuntu etc. licenses were just created with some kind of scripted default values and nobody
has bothered to change them because the charges are always zero anyway?

Anyway, I hope this has shed a little light on how to dig into a cloud bill from Google.
