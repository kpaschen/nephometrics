---
title: "San Junipero is a Dystopia"
date: 2021-10-27T13:47:01+02:00
draft: false
---

Warning: contains minor spoilers for "San Junipero" and other [Black Mirror](
https://en.wikipedia.org/wiki/Black_Mirror) episodes.

I often hear people say that "San Junipero" is unique among Black Mirror episodes for not
being dystopian. I disagree.

On the face of it, San Junipero promises a blissful life after death. People's minds get uploaded
before they die, and then they (well, their avatars) get to spend eternity in a seaside town modelled on
the 80's. I assume there will be other towns representing other time periods, so you'd get to choose.

The episode shows brief glimpses of the technical side of things: 
the company behind San Junipero is called "TCKR"; mind uploading happens via
a small round white button attached to a person's temple (we see a similar device in other episodes),
and then the person's data gets stored on a sleek white stick, which gets slotted
into a larger computer. It's possible to try San Junipero whilst still among the living, but
their real business is with the afterlife. The offering is not free, and at least the
two customers we meet appear to be affluent, though not super-rich.

I work in cloud infrastructure. When I see a setup like the one here, I think about what their
system architecture is going to look like, and what sort of issues they'll be dealing with. Somehow, no matter which aspect I think about, I end up with 
another reason why I wouldn't want to sign up.

## Working assumptions

Mind uploading isn't a thing (yet, that I know of), so here is some speculation.

### Assumption 1: TCKR are close to breaking even, perhaps even making a profit.
For all we know, they might be one of those "unicorns" eternally backed by yet another round of venture capital, but
let's assume they at least have a plan for how to make their revenue catch up with their expenses.

If they don't, eternity could be rather short; or who knows, very long and unpleasant---what exactly
do TCKR's terms and conditions say about what happens to your mind if TCKR ceases to exist? Are you
sure they don't reserve the right for whoever acquires them to "monetize" your mind as a digital assistant, say?

### Assumption 2: Pricing

TCKR charges for their services. I guess the easiest would be a subscription fee (users pay by the
month and can opt to be put into storage if they need to save money) or a pay as you go model (users
decide when and how long they want to be "awake"). How much might they be charging? TCKR's running
costs will provide a lower bound for their prices, but they'll probably charge as much as they
think their market can bear. 

A reasonable starting point for a monthly fee is probably "less than a decent assisted-living facility". A quick web search tells me the average is
[$4,300 per month](https://www.seniorliving.org/assisted-living/costs/#:~:text=According%20to%20Genworth%20Financial%2C%20the,per%20month%20or%20%2451%2C600%20annually.). However, some of this
may be financed through an insurance policy, and I doubt that there will be an insurance
that covers San Junipero membership fees in perpetuity. Maybe they'll give you a choice
between n months of assisted living and m > n months in San Junipero.

If TCKR limit their target market to those who can afford to pay several thousand dollars
a month out of their estates, their customer base will be small. TCKR can either position
themselves as a luxury service with an intentionally small ("exclusive") market,
or they can try to offer cheaper services.

### Assumption 3: There will be pressure to reduce running costs

The systems we see here will have required a large upfront investment in R&D. I'll assume this was
done as part of initial financing rounds for TCKR, so it'll be reflected in the shares that they've
given to investors. So where do their running costs come from?

As far as I can tell, notably expensive areas for TCKR will be:

1.   Computer hardware
1.   Running data centres
1.   Lawyers
1.   Security
1.   Computer engineers (developers and operators)

Out of these, the computer hardware and the data centres are probably the items where cost growth
correlates most strongly with the growth of the customer base, and also the ones where cost savings are easy to
imagine. Some of my dystopian ideas come from thinking of the cost savings measures that people
at TCKR are likely to come up with.

## So why is it a dystopia then?

### Security

San Junipero is a great target for ransomware attacks. How much
do you think relatives will pay to decrypt their grandmother? Their child? How much 
do you think TCKR will pay just to avoid anyone knowing the ransomware attack ever happened?

But "encrypting" the dead souls is perhaps the best outcome for them. There are much worse things
an attacker could do; remember [The Black Museum](https://en.wikipedia.org/wiki/Black_Museum_(Black_Mirror)).
How much do you think relatives will pay to save someone's soul from eternal torment?

### The incentive to reduce costs
I promise: it does not matter how much exactly it will
cost per month to host a dead person, somebody at TCKR will have a project for cost reduction.

Just to make it more realistic, I have prepared a [sample presentation](https://drive.google.com/file/d/1Bxf6uw714arb4IplBsxdGdYgh5NJJ-Dy/view?usp=sharing) for what the internal cost-reduction project
at TCKR could look like. The presentation is terse because it is aimed at executives, so below
are more details.

You want to use less hardware per dead soul. This means fewer or less powerful CPUs or less storage. If you run someone
on fewer CPUs, does their experience degrade? Would it be like slowly reducing the 
resolution on a video? Or maybe
you could simply not run someone for a while. Maybe nobody will notice. You probably have data on
your customers' interactions in San Junipero. Are there some that nobody would miss? Also, maybe
you're already using "time out" as a disciplinary measure. Say for people who start fights or who
just ruin the atmosphere for everyone else.

If you want to use less storage, you'll probably start with compression. You could start with lossless compression,
but that requires more CPU and of course there are limits to its effectiveness.
 Eventually, you'll consider lossy compression. Just like [Google did with
Photos](https://www.theverge.com/2021/5/24/22451607/google-photos-high-quality-storage-saver-tool-free-space-blurry-screenshots).
 What happens if you apply lossy compression to a person's mind? Maybe memories just become
a little fuzzy. Maybe some details are lost. Who's going to notice?

You can do more with compression. We have a very specific data domain here. There's probably some
potential for custom compression algorithms, much like there is in [video](https://en.wikipedia.org/wiki/Data_compression#Video).

But there is even more. You have a population of
people who died around the same time and chose a particular era for their afterlife. Chances are they
share some cultural background and some memories. What if you used that for more efficient compression?

Lots of people remember the moon landings, or Watergate, or the Challenger explosion, or the Berlin wall coming down, or `9/11`. A lot of their memories are similar because they watched the same pictures
on TV. 
You can probably get away with storing one "base" version of that memory and then only encoding
how each individual's memory differs from that ("I watched Charles and Diana walk down the aisle as I was sitting in my grandmother's front room"). This breaches a barrier: you've now removed
the isolation of people's memories from each other. But there will be corporate pressure and someone
will implement this. They might even get promoted for it.

You'll have [compression artifacts](
https://en.wikipedia.org/wiki/Compression_artifact). Maybe they'll feel like d&eacute;j&agrave; vus.

Every time you apply a cool idea to reduce costs, you'll take away a little of what made each of
the minds in your system unique. But they probably won't notice. After all, you have full access
to their minds, and what else are they going to use to understand what's going on?

Eventually of course, someone will find out anyway, and then there'll be corporate spin that
says "Oh but we're doing this to make the afterlife available to wider sections of society! What a sad and exclusionary elitist you are! Why do you hate poor people?"

### Make the dead participate in capitalism
San Junipero is a "disruptive" technology because it makes the deceased available as consumers.

Just as population growth is about to [turn a corner](https://ourworldindata.org/future-population-growth#global-population-growth), here comes a way to expand markets anyhow. First, you get
people paying for San Junipero membership; certainly other monetization ideas will follow. Do
you think those houses and their furniture, and the outfits people wear, will be free? I expect
you'll get basic clothes provided but everything else you'll have to pay for. Probably like the Sims, but with no
way of "earning" in-game currency via daily tasks because there's no need to incentivize 
engagement in a captive audieence.

This means you get to advertise to the deceased too.

At least some of the money the deceased spend will come from their capital
and from passive income. But decent interest rates are harder and harder
to get. Sooner or later at least some of the inhabitants of San Junipero
will be looking for work.

And now we have the deceased as a labour pool. They could work as a digital assistant, or
maybe by driving driverless cars. Anything that can be done remotely, really.
It's great because the deceased cannot be physically injured and they have
no need for food, sleep, or even pee breaks.

### Some people will create hell all by themselves
I've outlined technical reasons why San Junipero could turn out to be less
than utopian. But even if TCKR are a truly well-intentioned company and
do everything to prevent dystopia, chances are people will turn San Junipero
bad anyway.

What will happen when a marriage
fails? Fails non-amicably? Sure, there's no physical violence, as such. No
murders. But people don't need physical pain to make each other miserable,
especially in a very confined space with no escape.

Sooner or later, someone will start a committee. Maybe it'll be about
making sure everyone stays "in period". No references to things that happened
after the 80's. Think of it like a home owners' association, but forever.


