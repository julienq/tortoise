// Additional functions in the logo namespace for turtle graphics
// (browser-only, but maybe a node backend could be made to produce SVG or PNG
// offline?)

var SVG_NS = "http://www.w3.org/2000/svg";

var $svg_turtle = {};
{
};

$svg_turtle.clean = function()
{
  var child = this._fg.firstElementChild;
  while (child) {
    var next = child.nextElementSibling;
    this._fg.removeChild(child);
    child = next;
  }
};

Object.defineProperty($svg_turtle, "pos", { enumerable: true,
    configurable: true,
    set: function(p) {
       if ("x" in p) this._x = p.x;
       if ("y" in p) this._y = p.y;
       if ("heading" in p) this._heading = p.heading;
       this._elem.setAttribute("transform", "translate({0},{1}) rotate({2})"
         .fmt(this._x, this._y, this._heading))
     }
  });

Object.defineProperty($svg_turtle, "drawing", { enumerable: true,
    configurable: true,
    get: function() { return !!this._path; },
    set: function(p) {
        var drawing = !!this._path;
        p = !!p;
        if (p !== drawing) {
          this.set_path(p);
          this._elem.setAttribute("fill-opacity", p ? 1 : 0.5);
        }
      }
  });

Object.defineProperty($svg_turtle, "shown", { enumerable: true,
    configurable: true,
    get: function() { return this._elem.style.display !== "none"; },
    set: function(p) {
        this._elem.style.display = p ? "" : "none";
      }
  });

$svg_turtle.forward = function(d)
{
  var a = (this._heading * Math.PI / 180) - Math.PI / 2;
  var x = this._x + d * Math.cos(a);
  var y = this._y + d * Math.sin(a);
  this.pos = { x: x, y: y };
  if (this._path) {
    this._path.setAttribute("d", "{0}L{1},{2}"
        .fmt(this._path.getAttribute("d"), x, y));
  }
};

$svg_turtle.home = function()
{
  this.pos = { x: 0, y: 0, heading: 0 };
  this.set_path(this.drawing);
};

$svg_turtle.set_path = function(p)
{
  if (p) {
    this._path = document.createElementNS(SVG_NS, "path");
    this._path.setAttribute("d", "M{0},{1}".fmt(this._x, this._y));
    this._path.setAttribute("fill", "none");
    this._path.setAttribute("stroke", "white");
    this._fg.appendChild(this._path);
  } else {
    this._path = null;
  }
};

$svg_turtle.turn = function(incr)
{
  this.pos = { heading: this._heading + incr };
};


function svg_turtle(elem, fg, proto)
{
  var o = Object.create(proto || $svg_turtle);
  o._elem = elem;
  o._fg = fg;
  o.home();
  o.shown = true;
  o._path = null;
  o.drawing = true;
  return o;
};


var turtle = this.turtle = svg_turtle(document.getElementById("svg_turtle"),
    document.getElementById("svg_fg"));

// Predefined words; from http://www.cs.berkeley.edu/~bh/usermanual
// TODO SETPOS, SETXY, SETX, SETY, SETHEADING, ARC, XCOR, YCOR, HEADING,
// TOWARDS, SCRUNCH, WRAP, WINDOW, FENCE, FILL, FILLED, LABEL,
// SETLABELHEIGHT, TEXTSCREEN, FULLSCREEN, SPLITSCREEN, SETSCRUNCH, REFRESH,
// NOREFRESH, SHOWN?, SCREENMODE, TURTLEMODE, LABELSIZE, PENPAINT, PENERASE,
// PENREVERSE, SETPENCOLOR, SETPALETTE, SETPENSIZE, SETPENPATTERN, SETPEN,
// SETBACKGROUND, PENDOWN?, PENMODE, PENCOLOR, PALETTE, PENSIZE, PENPATTERN,
// PEN, BACKGROUND, SAVEPICT, LOADPICT, EPSPICT, MOUSEPOS, CLICKPOS, BUTTON?,
// BUTTON

// BACK dist
// BK dist
//   moves the turtle backward, i.e., exactly opposite to the direction
//   that it's facing, by the specified distance.  (The heading of the
//   turtle does not change.)
logo.procedures.BACK = function(tokens, f)
{
  logo.eval_number(tokens, function(dist) {
      turtle.forward(-dist.value);
      f();
    }, f);
};

// CLEAN
//   erases all lines that the turtle has drawn on the graphics window.
//   The turtle's state (position, heading, pen mode, etc.) is not changed.
logo.procedures.CLEAN = function(tokens, f) { turtle.clean(); f(); };

/*
// CLEARSCREEN
// CS
//   erases the graphics window and sends the turtle to its initial
//   position and heading.  Like HOME and CLEAN together.
logo.procedures.CLEARSCREEN = logo.procedures.CS = function(tokens)
{
  logo.procedures.CLEAN(tokens);
  logo.procedures.HOME(tokens);
};
*/

// FORWARD dist
// FD dist
//   moves the turtle forward, in the direction that it's facing, by
//   the specified distance (measured in turtle steps).
logo.procedures.FORWARD = function(tokens, f)
{
  logo.eval_number(tokens, function(dist) {
      turtle.forward(dist.value);
      f();
    }, f);
};

// HIDETURTLE
// HT
//   makes the turtle invisible.  It's a good idea to do this while
//   you're in the middle of a complicated drawing, because hiding
//   the turtle speeds up the drawing substantially.
logo.procedures.HIDETURTLE = function(tokens, f) { turtle.shown = false; f(); };

// HOME
//   moves the turtle to the center of the screen.  Equivalent to
//   SETPOS [0 0] SETHEADING 0.
logo.procedures.HOME = function(tokens, f) { turtle.home(); f(); };

// LEFT degrees
// LT degrees
//   turns the turtle counterclockwise by the specified angle, measured
//   in degrees (1/360 of a circle).
logo.procedures.LEFT = function(tokens, f)
{
  logo.eval_number(tokens, function(degrees) {
      turtle.turn(-degrees.value);
      f();
    }, f);
};

// PENDOWN
// PD
//   sets the pen's position to DOWN, without changing its mode.
logo.procedures.PENDOWN = function(tokens, f) { turtle.drawing = true; f(); };

// PENUP
// PU
// sets the pen's position to UP, without changing its mode.
logo.procedures.PENUP = function(tokens, f) { turtle.drawing = false; f(); };

// POS
//   outputs the turtle's current position, as a list of two
//   numbers, the X and Y coordinates.
logo.procedures.POS = function(tokens, f)
{
  var list = logo.list();
  list.value.push(logo.word(turtle._x));
  list.value.push(logo.word(-turtle._y));
  f(undefined, list);
};

// RIGHT degrees
// RT degrees
//   turns the turtle clockwise by the specified angle, measured in
//   degrees (1/360 of a circle).
logo.procedures.RIGHT = function(tokens, f)
{
  logo.eval_number(tokens, function(degrees) {
      turtle.turn(degrees.value);
      f();
    }, f);
};

// SHOWTURTLE
// ST
//   makes the turtle visible.
logo.procedures.SHOWTURTLE = function(tokens, f) { turtle.shown = true; f(); };
