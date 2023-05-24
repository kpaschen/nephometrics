---
title: "CMake, OpenCV, and Unit tests"
date: 2019-05-07T10:41:44+02:00
draft: false
tags: ["opencv", "musicocr", "cmake", "tesseract"]
---

For my ongoing [Music OCR hobby project](./music-ocr-introducing-the-idea/),
 I use [OpenCV](https://opencv.org) and
C++. For inline text, I've been experimenting with OpenCV's Tesseract support,
 which relies on the
[OCRTesseract class](https://docs.opencv.org/3.4/d7/ddc/classcv_1_1text_1_1OCRTesseract.html)
 from OpenCV's cv::text package. And of course I want to use unit tests; I chose
[Googletest](https://github.com/google/googletest/blob/master/googletest/docs/primer.md).

I'll write more on how I use OpenCV and my experience with Tesseract another time;
today is all about getting things to compile and link.

### Basic CMake file to get C++ code to compile

I hadn't used CMake before, but from what I can tell, it's a generator for build files, and it supports Makefiles as one of its outputs.
There is [documentation](https://cmake.org/documentation/) and [tutorials](
https://cmake.org/cmake-tutorial) as well as a wealth of answers on
[StackOverflow](https://www.stackoverflow.com). Just compiling a simple C++
file is pretty straightforward by following the tutorial:

* Write a hello world-type program and save it as opencv_demo.cpp:

```
#include <iostream>

int main(int argc, char **argv) {
  std::cout << "Hello OpenCV" << std::endl;
}
```

* In the root directory of your source tree, create a file called CMakeLists.txt with the following three lines:

```
cmake_minimum_required(VERSION 3.1)
project(HelloOpenCV)
add_executable(HelloOpenCV opencv_demo.cpp)
```

* Make a build directory and call cmake from there:
```
mkdir build ; cd build ; cmake ../src
```

There's actually multiple ways to do this -- the above is what I do. For my setup,
this generates Unix Makefiles by default, which is what I want. `cmake --help`
shows the list of generators supported on the current system, and you can select
one with the `-G` option to `cmake`.

In your `build` directory, you'll now find a `CMakeCache.txt` file listing
a lot of settings that `cmake` has found, such as the path to the compiler
and the linker. There's also an install script called `cmake_install.cmake`,
a `Makefile`, and a directory called `CMakeFiles`. `Makefile` mostly just
calls `CMakeFiles/Makefile2`.

As expected, `make` creates an executable file called `HelloOpenCV`. The generated
Makefiles do not contain an `install` target; I think that target only gets
generated if you add an
 [`install` command](https://cmake.org/cmake/help/v3.13/command/install.html)
 to `CMakeLists.txt` and then that target will use the generated install script.

One word of advice: you do not technically have to use a separate `build` directory
(though some codebases enforce this, for example when you try to compile OpenCV).
It makes things a lot easier though! There are situations where you want to make
sure to re-run `cmake` from scratch, and there is no `cmake clean` command or
equivalent. I've found it easiest to just `rm -rf build/*`.

### Linking OpenCV

Next, here's a basic tool that just shows an image from a file.
Some of the steps are also documented [on the OpenCV website](
https://docs.opencv.org/3.4.3/d7/d9f/tutorial_linux_install.html).

```
#include <iostream>

#include <opencv2/core/core.hpp>
#include <opencv2/highgui/highgui.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/opencv.hpp>

int main(int argc, char **argv) {
  if (argc < 2) {
    std::cerr << "Please provide a path to an image file.";
    return -1;
  }
  std::string filename = argv[1];
  cv::Mat image = cv::imread(filename, 1);
  if (!image.data) {
    std::cerr << "No image data read.";
    return -1;
  }
  cv::resize(image, image, cv::Size(), 0.2, 0.2, cv::INTER_AREA);
  cv::namedWindow("Your Image", cv::WINDOW_AUTOSIZE);
  cv::imshow("Your Image", image);

  cv::waitKey(0);
  return 0;
}
```

And here is the CMakeLists.txt file that goes with it:

```
cmake_minimum_required(VERSION 3.1)
project(HelloOpenCV)

find_package(OpenCV REQUIRED)
message(STATUS "OpenCV library status:")
message(STATUS "    version: ${OpenCV_VERSION}")
message(STATUS "    libraries: ${OpenCV_LIBS}")
message(STATUS "    include path: ${OpenCV_INCLUDE_DIRS}")

include_directories(${OpenCV_INCLUDE_DIRS})

add_executable(HelloOpenCV opencv_demo.cpp)
target_link_libraries(HelloOpenCV ${OpenCV_LIBS})
```

Now if you type `cmake ../src`, and you have OpenCV (including the header files)
installed, you should see output like this:

```
-- OpenCV library status:
--     version: 3.3.1
--     libraries: opencv_calib3d;opencv_core;opencv_dnn;opencv_face;opencv_features2d;opencv_flann;opencv_highgui;opencv_imgcodecs;opencv_imgproc;opencv_ml;opencv_objdetect;opencv_photo;opencv_shape;opencv_stitching;opencv_superres;opencv_video;opencv_videoio;opencv_videostab
--     include path: /usr/include;/usr/include/opencv
```

That happens to be the OpenCV version I installed on my machine using package
management. I installed the development headers as well, and verified that
the versions match by looking at `/usr/include/opencv2/core/version.hpp`.

You'll notice that the most-used header files for OpenCV are actually in
the `opencv2` directory rather than `opencv`, but the include path above
contains `/usr/include` and the header files I want are in `/usr/include/opencv2/`,
so this works.

### Different versions of OpenCV, and adding modules

 I also downloaded the latest OpenCV source tree from github,
including the opencv_extra and opencv_contrib repositories. That code lives
in a subdirectory of my $HOME.

CMake has a pretty involved [methodology for locating packages](
https://cmake.org/cmake/help/v3.0/command/find_package.html). It looks to be
a combination of parameters you can set on the find_package call, variables
set in your CMake config files or via command-line parameters to cmake, environment
variables and even some heuristics (like 'Search project trees recently configured
 in a cmake-gui').

If I just wanted to #include and link against the OpenCV code in my home directory,
I could hardcode a value for OpenCV_DIR in
my CmakeLists.txt:

```
set(OpenCV_DIR "/home/<username>/git-experiments/musicocr/opencv/opencv/build")
```

Or I can compile and `make install` OpenCV from there and then configure CMake
to look for the OpenCV module where I put it. Either way, I need to compile
and link the OpenCV code including the extra modules I want to use.

To that end, I called `cmake` with `-DOPENCV_EXTRA_MODULES_PATH=../opencv_contrib/modules`. I also worked out the following settings:

```
cmake \
-DCMAKE_BUILD_TYPE=RELEASE -DBUILD_EXAMPLES=ON \
-DWITH_LIB4L=OFF -DWITH_V4L=OFF \
-DOPENCV_EXTRA_MODULES_PATH=../opencv_contrib/modules
```

I added the `LIB4L` and `V4L` parameters because I was getting missing includes
errors otherwise. I had to install the devel package for `libpng` and `libv4l-devel`
in order to get the `png.h` and `videodev.h` headers. `libv4l-devel` actually gave
me a file called `/usr/include/linux/videodev2.h`, and I created a symlink called
`/usr/include/linux/videodev.h` pointing to `videodev2.h`, which made the linker
happy, though I still don't think this is how software installation should be done.
It's a workaround for a known issue and has been [discussed on StackOverflow](
https://stackoverflow.com/questions/5842235/linux-videodev-h-no-such-file-or-directory-opencv-on-ubuntu-11-04). In principle, just switching both libraries off (as
I did above) should have been enough, but it wasn't, for me. 

`LIB4L` and `V4L` are two libraries supporting video capture. You need at most
one of them. I need neither of them because I don't intend to do video capture,
so I went with whatever made the code I actually wanted compile.

With these parameters, I got OpenCV including the extra modules to compile and link. At first,
I got an output saying there had been errors (`-- Configuring incomplete, errors occurred!`) and that I should look in `CMakeOutput.log` and `CMakeError.log`. Unfortunately,
those files were full of warnings about unsupported compiler options such as
`-Wno-unnamed-type-template-args` that are probably ok to ignore. In the end, I got
no useful information from these files (though I'm sure they can be useful
in other situations), but when I took a good look at my `cmake` invocation,
I noticed a typo in the value of `OPENCV_EXTRA_MODULES_PATH` (which I have corrected above because
the whole point of sharing these tips is for you to have a chance to run into different issues :-).

And then, after all this, when I executed my binary, I got a core dump:

```
terminate called after throwing an instance of 'cv::Exception'
  what():  OpenCV(4.0.0-pre) /home/me/git-experiments/musicocr/opencv/opencv/modules/highgui/src/window.cpp:615: error: (-2:Unspecified error) The function is not implemented. Rebuild the library with Windows, GTK+ 2.x or Carbon support. If you are on Ubuntu or Debian, install libgtk2.0-dev and pkg-config, then re-run cmake or configure script in function 'cvNamedWindow'
```

That was disappointing. Scrolling back through the output of `cmake`, I could
see it had in fact decided not to compile with GUI support because it could not
find development headers for GTK. I located the package to install (`gtk3-devel`
for OpenSUSE, it'll be called something else on other Linux distributions), ran
`cmake` again, and got:

```
--   GUI: 
--     GTK+:                        YES (ver 3.22.30)
--       GThread :                  YES (ver 2.54.3)
--       GtkGlExt:                  NO
--     VTK support:                 NO
```

### Using Tesseract

It's pretty cool that libraries such as OpenCV and Tesseract
are freely available. I love using them, even when it takes me a few
attempts and some experimentation to get things right. Below are some tips
that might save you time getting started, but of course there is a lot more
to discover.

Here is some very basic code extending the `opencv_demo.cpp` file above
to it runs character recognition on the image you feed it and prints
some information on what it found:
```
#include <fstream>
#include <iostream>
#include <vector>

#include <opencv2/core/core.hpp>
#include <opencv2/highgui/highgui.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/opencv.hpp>
#include <opencv2/text.hpp>

int main(int argc, char **argv) {
  if (argc < 2) {
    std::cerr << "Please provide a path to an image file.";
    return -1;
  }
  std::string filename = argv[1];
  cv::Mat image = cv::imread(filename, 1);
  if (!image.data) {
    std::cerr << "No image data read.";
    return -1;
  }
  cv::resize(image, image, cv::Size(), 0.2, 0.2, cv::INTER_AREA);
  cv::namedWindow("Your Image", cv::WINDOW_AUTOSIZE);
  cv::imshow("Your Image", image);

  cv::waitKey(0);

  cv::Ptr<cv::text::OCRTesseract> tess = cv::text::OCRTesseract::create(
    NULL, NULL, NULL, cv::text::OEM_DEFAULT, cv::text::PSM_SINGLE_WORD);

  std::string output_text;
  std::vector<cv::Rect> component_rects;
  std::vector<std::string> component_texts;
  std::vector<float> component_confidences;
  cv::Mat local = image.clone();

  tess->run(local, output_text, &component_rects, &component_texts,
            &component_confidences, cv::text::OCR_LEVEL_WORD);

  std::cout << "Tesseract says: " << output_text << std::endl;
  std::cout << "found " << component_rects.size() << " characters: " << std::endl;
  for (int i = 0; i < component_rects.size(); i++) {
    std::cout << "character " << i << ": " << component_texts[i]
              << " with confidence " << component_confidences[i] << std::endl;
  }
  return 0;
}
```

And here's how to build it:

I specified the location of the tesseract package (again by pointing to
my own directory because I thought I might need to compile multiple times
with different settings and wanted to hold off on `make install` until I had
a good version):

```
set(Tesseract_DIR "/home/<username>/git-experiments/musicocr/tesseract/build")
find_package(Tesseract REQUIRED)
```

Here's the updated `CMakeLists.txt` file in full:
```
cmake_minimum_required(VERSION 3.1)
project(HelloOpenCV)

set(OpenCV_DIR "/home/<username>/git-experiments/musicocr/opencv/opencv/build")
find_package(OpenCV REQUIRED)
message(STATUS "OpenCV library status:")
message(STATUS "    version: ${OpenCV_VERSION}")
message(STATUS "    libraries: ${OpenCV_LIBS}")
message(STATUS "    include path: ${OpenCV_INCLUDE_DIRS}")

set(Tesseract_DIR "/home/<username>/git-experiments/musicocr/tesseract/build")
find_package(Tesseract REQUIRED)
message(STATUS "Tesseract library status:")
message(STATUS "    version: ${Tesseract_VERSION}")
message(STATUS "    libraries: ${Tesseract_LIBS}")

include_directories(${OpenCV_INCLUDE_DIRS})
include_directories(${Tesseract_INCLUDE_DIRS})

add_executable(HelloOpenCV opencv_demo.cpp)
target_link_libraries(HelloOpenCV ${OpenCV_LIBS})
target_link_libraries(HelloOpenCV ${TESSERACT_LIBRARIES})
```

Note I also installed the `tesseract-ocr` commandline tool, which brought some essential language files with it, as well as the `leptonica` library.

You can run `HelloOpenCV` with any image file, Tesseract will do its best to interpret the image
as a word.
Just specify the path to an image file on the commandline; the tool will display the image file
on your screen and wait for you to hit any key. Once you've hit a key, the tool will run Tesseract,
print what it found, and exit.

A few comments on options you may want to play around with:

   1. There's a [commandline version of Tesseract](https://github.com/tesseract-ocr/tesseract/wiki/Command-Line-Usage) that's great for playing around with options.
   1. Read more about how Tesseract works and what some of the options mean e.g. [here](https://www.learnopencv.com/deep-learning-based-text-recognition-ocr-using-tesseract-and-opencv/)
   1. You can find all the options documented [here](https://docs.opencv.org/3.4/d7/ddc/classcv_1_1text_1_1OCRTesseract.html) (you may need to look for the right version)
   1. In general, OCR works best on clean black-on-white inputs. Noise in the image (smudges, pixelations, generally things that aren't text) as well as skew will throw off OCR accuracy. The command-line tool is very helpful in working out the minimum level of image quality that will work for your purposes.


### Integrating with googletest

Finally, unit tests. Multiple frameworks are available, and you should choose one you like. I had
used [googletest](https://github.com/google/googletest) previously and did not want to learn a new
testing framework on top of teaching myself OpenCV.

The good news is that Googletest comes with [extensive CMake instructions](
https://github.com/google/googletest/blob/master/googletest/README.md). However, the 
favoured/most highly recommended option is to instruct CMake to obtain the latest version of the
library from github when you run `cmake`. While there are reasons for doing this
([reasoning from Google](https://github.com/google/googletest/blob/master/googletest/docs/FAQ.md#why-is-it-not-recommended-to-install-a-pre-compiled-copy-of-google-test-for-example-into-usrlocal),
[discussion on StackOverflow](https://stackoverflow.com/questions/13513905/how-to-setup-googletest-as-a-shared-library-on-linux)), this means you cannot run `cmake` when you don't have
internet access. I spend a lot of time on trains and like to write code (and run tests)
without having constant internet access, so this is not ideal for me. For the time being,
I've gone with the recommended approach (update from github) and just try to remember not to
run `cmake` while offline.


