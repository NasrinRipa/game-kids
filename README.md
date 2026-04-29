XONIX-2
===============

XONIX-2 is a JavaScript/Canvas remake of the classic [Xonix](https://en.wikipedia.org/wiki/Xonix) arcade game. It features a picture (image) hidden behind the playing field that is progressively revealed as you conquer territory, with added features like bonus pickups in the style of the snake game. Original code borrowed from https://github.com/hindmost/picxonix


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
