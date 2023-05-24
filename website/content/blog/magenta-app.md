---
title: "Magenta App"
date: 2019-07-23T12:10:58+02:00
tags: ["magenta", "nodejs", "express"]
---

Continuing on from [Serving Magenta](/2019/06/serving-magenta/), I wanted
to put a little web application together.

What I really want is to make my phone play music by whistling into it.
Basically, I whistle, the phone tries to match the melody against my music
collection and plays whatever is the closest match. This might be a little
silly, and I don't know that it'll have mass appeal (I'm probably in a minority
in that I still have most of my music collection in files on my computer),
but I'm not looking to make money from this.

Whistling into a microphone gives me raw audio, and transcoding that into
 common formats such as OGG Vorbis or MP3 is generally not a problem. The
[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
had pretty much all the tools I wanted. However, machine-learning models in
music seem to be typically based on MIDI inputs rather than raw audio. This makes
intuitive sense to me; MIDI may be serving as a normalization step. There is
software that translates various audio formats to MIDI, but it tends not to be
free -- not surprising given how much work this takes to do well. Luckily,
Magenta have a model called [Onsets and Frames](https://magenta.tensorflow.org/onsets-frames)
that does "automatic polyphonic piano music transcription". It is designed to 
operate on recordings of piano performances, but at least for demo purposes,
it worked just fine on recordings of me whistling or humming, or of a cat meowing.

If I wanted to train my own model, perhaps on a wider range of sounds, one way
of going about it would be to take a bunch of MIDI files, convert them to
e.g. MP3 (this is easy), and then use the MIDI/MP3 pairs as training inputs.
It's easy to create MIDI files, either programmatically or e.g. by processing
[Lilypond](http://lilypond.org/) files; for the latter, I'd want to check
with the authors of the files (and of the compositions, if they're still alive)
whether this is an acceptable use of their data. But this could be a fun project
for the future.

### Recording

For now, I had some fun getting my dissonant whistles transformed into piano
sounds. If you want to try for yourself, take a look at
[my demo page](https://demos.nephometrics.com/)
or you can clone [my github repository](https://github.com/kpaschen/magenta-clientside.git) and take it from there.

Edited (June 9th 2020): I used to have an iframe here with a demo, but have disabled it for now
 because I ran out of AWS starter credits. The github repository code should still work.

As mentioned in [Serving Magenta](/2019/06/serving-magenta/), the code I linked to
performs all the heavy lifting in the browser and it takes several seconds to
load because it has to obtain the ML model files. Especially on mobile devices,
this may take more time than you're willing to wait. For a more usable version,
I'll need to do more of the work server-side.

### Generating / finding music

The next step is using the midi inputs I just obtained and feed them into another
ML model to get a music suggestion. Eventually, I want to use a VAE (variational
auto encoder) model for this, but I need to train it on my own music collection
first. So for the time being, I used the pre-trained RNN models from the
magenta collection and wired them up with the Onsets and Frames model. This just
asks the model to compose a continuation of my whistled melody. It's a little hit
and miss in terms of musical quality, but nice enough to play with.

One thing to note is that the RNN models have a range of pitches that they'll
accept in their inputs. They'll throw an exception when inputs are outside their
pitch range.  The range is quite narrow 
(e.g. 48--83 for `basic_rnn` -- a piano range is 21--108) and my whistling easily
gets up to MIDI tone 96, so I added code to transpose the inputs into the accepted
pitch range. This was more difficult than (imho) it needed to be because the pitch
range is hidden in the model's `dataConverter`, which is private; so I used `fetch`
to obtain the `config.json` files for the models separately.

### The technical details (aka Things I Have Learned From This)

#### Accessing the microphone from a browser

You need the user's consent to access the microphone:

{{< highlight javascript >}}
navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
  // ... do things with the stream
});
{{< /highlight >}}

That's clearly a good thing. Who would want web pages to just access the microphone?
However, at least in Chrome, navigator.mediaDevices.getUserMedia is usable only if the
page is served over https or if it comes from localhost. So I got surprised by this
when I wanted to move from my development environment to a web host.

#### Processing audio streams in the browser

The magenta libraries use a MediaRecorder object, which gets initialized with the
audio stream obtained from `getUserMedia`. This can listen to a `dataavailable` event
where it gets new audio chunks. The frequency with which dataavailable events are
sent is configurable via a parameter to the `start()` method on the MediaRecorder.

However, a lot of examples and documentation on the web use the [Web Audio API](
https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API). I made a few attempts
to use audio data obtained through the Web Audio API as inputs to the Onsets and Frames
model's `transcribeFromX` methods, but always ended up with error messages complaining
of undecodable audio. It would have been nice to get the model to start transcribing
as soon as enough audio is available instead of waiting for recording to end; and it
would also have been nice to use the same framework for both the Onsets and Frames
inputs and the fft visualization that I added to the page, but after a while, I decided
it wasn't worth pouring more time into. The visualization is kind of nice
because it shows whether the microphone is picking up sounds at all, so I kept it and
the code just contains two separate objects that process the same stream.

#### Running on AWS

I decided that I wanted to host a demo, but my regular web page is all static. So I
brought up an instance on AWS because why not. Initially, I just created the instance,
logged into it using ssh (and realising eventually that the username for Ubuntu instances
is `ubuntu`, not `ec2_user`), installed npm there, transferred my code as a `.tgz` file,
unpacked it, ran `npm install` (because I had excluded `node_modules/` from my tar file),
and brought up the server. That worked insofar as the web page got served, but of
course recording did not work because I was not using https.

So I wanted to achieve two things:

   1. Be able to use https
   2. Make the installation and update process less manual

These are clearly both solved problems, otherwise AWS would not be in business. They still
cost me time, so here you go.

##### HTTPS on AWS

A bit of reading convinced me that the best (only? probably not the only) way to serve my
content via https was to set up a load balancer and acquire a certificate for it. A load
balancer needs a "Target Group" -- the set of instances to balance amongst. I think
an ELB (Elastic Load Balancer) needs to have at least two instances. I'm still not sure,
but I set up a second instance anyway because why run on AWS if you're going to be single
homed? 

I did not want to repeat the manual process, so I decided to use an AMI.
I created an AMI from my first instance; then (because of the documentation) I thought I
had to register it, which I could not do because I did not know the manifest path. Apparently,
maybe because I created the AMI directly from an EC2 instance, it was already registered.
The documentation and the few questions I found about this on Stackoverflow were
uncharacteristically unhelpful; I had the impression that maybe there had been several
versions of this feature over time. Or maybe I just did not have enough patience.

At any rate, I got the second instance started, set up a load balancer, which worked once
I wired it up to talk to the correct ports (the node webservers I bring up listen on port
3000 by default). Then I asked for a certificate via the AWS console. I used a domain
I own (nephometrics.com) and obtained a certificate for demos.nephometrics.com. Then,
in my domain's settings, I created a `CNAME` entry making `demos.nephometrics.com`
an alias for the load balancer's external IP. This resulted in a few hilarious (not)
hassles with the DNS settings related to my web hoster and I learned more than I
ever wanted to know about whether/how/why Linux caches DNS lookup results.

I also wanted to be able to test locally using https. Interestingly, I could not get the
recording to work in the iframe on this blog while running a local server so long as the
local server was using http rather than https. [Hugo](https://gohugo.io/commands/hugo_server/)
does not come with a local https mode. So I went and created my own localhost openssl
certificate and brought up a little node.js server locally. Chrome refused to accept
my certificate but Firefox allowed me to create a security exception. I think in order
to get this to work with Chrome [I should have created a local CA](
https://stackoverflow.com/questions/10175812/how-to-create-a-self-signed-certificate-with-openssl), but I decided I'd been deep enough into the rabbit hole by now. The discussion on
Stackoverflow was very good though, and really helped me clarify how certificates
work.

##### Docker vs. CodeDeploy

I wanted to update the code running on my instances without logging into
 them via ssh. Updating the AMI every time I fix a bug seemed like a lot of work. Indeed,
I think the right tool for this would be [CodeDeploy](https://aws.amazon.com/getting-started/tutorials/deploy-code-vm/) but I had been working through so many tutorials that all I wanted
was to use Docker and be done.

Most documentation around using AWS with Docker is for ECS, not EC2. Of course nothing
prevents you from installing Docker on your EC2 instances anyway, but I also wanted to
run locally built Docker images rather than publishing them to a registry (my demo code
does not need to be published to a registry). I ended up using [docker machine](
https://docs.docker.com/machine/overview/), which
lets me create EC2 instances and run docker images on them using my IAM credentials.


