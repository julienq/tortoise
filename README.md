A Logo interpreter in Javascript
==============================

**Tortoise** is a Logo interpreter written in Javascript, inspired by [Brian Harvey's UCB Logo](http://www.cs.berkeley.edu/~bh/). Its main features are:

* a standalone Javascript library: see `logo.js`;
* a Node.js REPL; see `tortoise.js`;
* an HTML5 front-end for turtle graphics; the turtle functions such as FORWARD, RIGHT/LEFT, PENUP/PENDOWN, etc. are exposed to Javascript. The turtle draws into an SVG document. See `turtle.js` and `tortoise.html`.


Usage
-----

The command-line version can be run with Node.js; the REPL is `tortoise.js`:

  ```
  > node tortoise.js
  Welcome to Logo
  ?
  ```

There are no command-line options at the moment.

The HTML version works by running the backend server in the `backend` directory, then connecting to that running server. For example:

  ```
  > cd backend
  > node backend.js
  14 May 12:11:55 - *** http://127.0.0.1:8910 ready
  ```

Then simply connect to http://127.0.0.1:8910/ to run the UI (not really functional at the moment, though.) You can change IP, HTTP port, document and templates location at the command line (see `backend.js`.)

**Note**: You can simply open the file `backend/documents/index.html` in a browser, but XMLHttpRequest may fail to get the library files (in Chrome on OS X for instance.)
