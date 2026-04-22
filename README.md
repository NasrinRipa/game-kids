## PicXonix
===============

PicXonix is a sort of framework for making [Xonix](https://en.wikipedia.org/wiki/Xonix) clones on JavaScript/Canvas. It features a picture (image) hidden behind the playing field, with added features like eating bonus like snake game. Original code borrowed from https://github.com/hindmost/picxonix


## Running Locally

This project uses ES modules. To run the demo locally, you need to serve the files over HTTP because browsers block ES module imports when using the `file://` protocol.

The simplest way is to start a local static server in the project folder. For example, with Python 3:

```bash
# from the project root
python -m http.server 8000
