// Additional functions in the logo namespace for turtle graphics
// (browser-only, but maybe a node backend could be made to produce SVG or PNG
// offline?)
// This version uses canvas to draw, as opposed to SVG (but should have an SVG
// export anyway.)

logo.$turtle = Object.create(populus.$object);

logo.$canvas_turtle = Object.create(logo.$turtle);

logo.canvas_turtle = function(bg, fg, active, proto)
{
  var o = Object.create(proto || logo.$canvas_turtle);
  o.bg = bg.getContext ? bg.getContext("2d") : bg;
  o.fg = fg.getContext ? fg.getContext("2d") : fg;
  o.active = active.getContext ? active.getContext("2d") : active;
  return o;
};

logo.$canvas_turtle.clean = function()
{
  var W = this.bg.canvas.width;
  var H = this.bg.canvas.height;
  this.bg.fillRect(0, 0, W, H);
  this.fg.clearRect(0, 0, W, H);
  this.fg.strokeStyle = "white";
};

logo.$canvas_turtle.forward = function(d)
{
  var W = this.fg.canvas.width / 2;
  var H = this.fg.canvas.height / 2;
  this.fg.beginPath();
  console.log("moveTo({0}, {1})".fmt(W - this.x, H + this.y));
  this.fg.moveTo(W - this.x, H + this.y);
  var a = (this.heading * Math.PI / 180) - Math.PI / 2;
  this.x += d * Math.cos(a);
  this.y += d * Math.sin(a);
  console.log("lineTo({0}, {1})".fmt(W - this.x, H + this.y));
  this.fg.lineTo(W - this.x, H + this.y);
  this.fg.stroke();
};

logo.$canvas_turtle.home = function()
{
  this.x = 0;
  this.y = 0;
  this.heading = 0;
};

logo.$canvas_turtle.turn = function(incr)
{
  this.heading += incr;
};

logo.init_canvas_turtle = function(bg, fg, active, proto)
{
  turtle = logo.canvas_turtle(bg, fg, active, proto);

  // BACK dist
  // BK dist
  //   moves the turtle backward, i.e., exactly opposite to the direction
  //   that it's facing, by the specified distance.  (The heading of the
  //   turtle does not change.)
  logo.procedures.BACK = function(tokens, f)
  {
    logo.eval_number(tokens, function(dist) {
        turtle.forward(-dist.value);
        f(undefined, logo.token());
      }, f);
  };

  // CLEAN
  //   erases all lines that the turtle has drawn on the graphics window.
  //   The turtle's state (position, heading, pen mode, etc.) is not changed.
  logo.procedures.CLEAN = function(tokens, f)
  {
    turtle.clean();
    f(undefined, logo.token());
  };

  // FORWARD dist
  // FD dist
  //   moves the turtle forward, in the direction that it's facing, by
  //   the specified distance (measured in turtle steps).
  logo.procedures.FORWARD = function(tokens, f)
  {
    logo.eval_number(tokens, function(dist) {
        turtle.forward(dist.value);
        f(undefined, logo.token());
      }, f);
  };

  // HOME
  //   moves the turtle to the center of the screen.  Equivalent to
  //   SETPOS [0 0] SETHEADING 0.
  logo.procedures.HOME = function(tokens, f)
  {
    turtle.home();
    f(undefined, logo.token());
  };

  // LEFT degrees
  // LT degrees
  //   turns the turtle counterclockwise by the specified angle, measured
  //   in degrees (1/360 of a circle).
  logo.procedures.LEFT = function(tokens, f)
  {
    logo.eval_number(tokens, function(degrees) {
        turtle.turn(-degrees.value);
        f(undefined, logo.token());
      }, f);
  };

  // POS
  //   outputs the turtle's current position, as a list of two
  //   numbers, the X and Y coordinates.
  logo.procedures.POS = function(tokens, f)
  {
    var list = logo.list();
    list.value.push(logo.word(turtle.x));
    list.value.push(logo.word(turtle.y));
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
        f(undefined, logo.token());
      }, f);
  };

  return turtle;
}
