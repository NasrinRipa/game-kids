PicXonix
===============

PicXonix is a kind of framework for creating [Xonix] clones with JavaScript and Canvas. The game reveals a hidden picture as you play, with added features like collecting bonuses similar to Snake. Original code from [hindmost/picxonix](https://github.com/hindmost/picxonix)


License
-------------
PicXonix is released under the [MIT License](http://www.opensource.org/licenses/MIT).

Development
-----------
This project uses ES modules. To run the demo locally you must serve the files over HTTP (browsers block module imports from file://). A simple way is to run a local static server in the project folder, for example with Python 3:

```sh
# from the project root
python -m http.server 8000
```

Then open http://localhost:8000/index.html in your browser.
