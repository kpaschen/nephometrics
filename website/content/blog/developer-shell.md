---
title: "Developer Shell"
date: 2019-04-21T11:39:45+02:00
draft: true
tags: ["musicocr"]
---

For my ongoing MusicOCR hobby project, I experiment a lot with various
OpenCV operations and their parameters. In order to make this easier for myself,
I've built myself a developer shell where I can load an image and apply processing
steps to it. So far, I've adapted and used the shell for the following processing
steps:

* detect outline of paper
* detect orientation
* crop, flip, maybe de-warp
* detect horizontal lines (groups of five horizontal lines that have notes on them) as well as vertical lines (bar lines may intersect multiple groups of horizontal
lines if a piece has several voices)
* within a group of horizontal lines, detect objects for detailed processing (these can be notes, accidentals, clefs, expressive marks, sometimes characters or words).

If you want to try this for yourself, please check out my [github repository](
TODO: link). You'll want to adapt the OpenCV library paths in the CMakeLists.txt
file, and you may find that your system is missing libraries and header files ---
I don't have an install script (yet), but I've written up the more difficult
steps in a [separate blog post](TODO).
