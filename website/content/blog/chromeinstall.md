---
title: "OpenSuSE update to Leap"
date: 2019-03-22T09:10:36+01:00
draft: false
tags: ["linux"]
---

My home computer runs OpenSuSE. Recently, it needed an upgrade that turned
into a new installation. Oh well, but at least now I'm running OpenSuSE Leap.

A new SuSE install always takes me a bit of time to set up the way I want it.
First, it'll always, always come without a C or C++ compiler, or indeed most
of the toolchain you'd need to compile and link, never mind debug. My go-to
is to download the <a href="https://www.nethack.org/">latest nethack sources</a>
and install tools until I can compile nethack.

A quick game of nethack, and back to setup. I have an ongoing project that
uses OpenCV, so I needed to install some supporting libraries and tools for
that; that might be a blog post of its own.

Then I wanted to install Google Chrome. You can
<a href="https://www.google.com/chrome/">download it from Google</a>. The 'install
file' that it gives you is just an rpm (
for SuSE/Fedora; you can also get a .deb file). Naively, I clicked on the
downloaded file in Chromium (yes, I wanted both Chromium and Chrome on my
machine, why not?) and it decided to start <a href="https://en.wikipedia.org/wiki/AppStream">AppStream</a>, which promptly popped up an alert window
asking me to make sure it has been properly installed. It did not say how to
do that or what precisely it was missing though.  
Then when I asked it again to install Google Chrome, it showed me another popup just saying
'Internal Error'. So not helpful. I hit the internet some more, found some SuSE
forum where the answer basically was "you'll be fine just installing Chromium". But
 why can't I install Google Chrome if I want to? Why does the tool not work?

Some more Internet searches showed that a lot of people just install chrome
using zypper. For example, <a href="https://www.linuxbabe.com/desktop-linux/how-to-install-google-chrome-on-opensuse-leap-42-1">here</a>. Since I already had the
rpm, I decided to continue with that though.

The downloaded file is just an rpm:

    file google-chrome-stable_current_x86_64.rpm 
    google-chrome-stable_current_x86_64.rpm: RPM v3.0 bin i386/x86_64

So let's try to install it manually:

    rpm -i google-chrome-stable_current_x86_64.rpm 
    warning: google-chrome-stable_current_x86_64.rpm: Header V4 DSA/SHA1 Signature, key ID 7fac5991: NOKEY
    error: Failed dependencies:
            libappindicator3.so.1()(64bit) is needed by google-chrome-stable-73.0.3683.75-1.x86_64

Ah, now this is information. I installed libappindicator3, tried again.
Now the rpm command even asked for root permissions, showing me it was getting further than before.

    rpm -i google-chrome-stable_current_x86_64.rpm 
    warning: google-chrome-stable_current_x86_64.rpm: Header V4 DSA/SHA1 Signature, key ID 7fac5991: NOKEY
    error: can't create transaction lock on /usr/lib/sysimage/rpm/.rpm.lock (Permission denied)

The NOKEY warning is telling me I should download Google's public signing key
and verify that I got the right packages.

    wget https://dl.google.com/linux/linux_signing_key.pub 
    sudo rpm --import linux_signing_key.pub

    rpm --checksig -v google-chrome-stable_current_x86_64.rpm 
    google-chrome-stable_current_x86_64.rpm:
    Header V4 DSA/SHA1 Signature, key ID 7fac5991: OK
    Header SHA1 digest: OK
    MD5 digest: OK
    V4 DSA/SHA1 Signature, key ID 7fac5991: OK

And now it works:

    sudo rpm -i google-chrome-stable_current_x86_64.rpm 
    service: no such service atd
    update-alternatives: using /usr/bin/google-chrome-stable to provide /usr/bin/google-chrome (google-chrome) in auto mode

The line about the `atd` service is harmless based on what I could find; looks
like Chrome wants the service enabled for scheduling, but it'll be fine
without it.

It's strange how happy it made me feel that I just spent a good part of a day
basically just getting my system usable again after an update.
