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
  Tortoise Logo v0.0.x (https://github.com/julienq/tortoise)
  Welcome to Logo
  ? 
  ```

There are no command-line options at the moment.
