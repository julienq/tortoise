// Additional functions in the logo namespace for turtle graphics
// (browser-only, but maybe a node backend could be made to produce SVG or PNG
// offline?)
// This version uses canvas to draw, as opposed to SVG (but should have an SVG
// export anyway.)

logo.turtle = populus.object.create();

logo.canvas_turtle = logo.turtle.create({

    init: function(bg, fg, active, proto)
    {
      var self = this.call_super("init");
      self.bg = bg.getContext ? bg.getContext("2d") : bg;
      self.fg = fg.getContext ? fg.getContext("2d") : fg;
      self.active = active.getContext ? active.getContext("2d") : active;
      return self;
    },

    // Predefined colors
    COLORS: [
        "#000", // 0 black
        "#00f", // 1 blue
        "#0f0", // 2 green
        "#0ff", // 3 cyan
        "#f00", // 4 red
        "#f0f", // 5 magenta
        "#ff0", // 6 yellow
        "#fff", // 7 white
        // 8 brown
        // 9 tan
        // 10 forest
        // 11 aqua
        // 12 salmon
        // 13 purple
        // 14 orange
        // 15 grey
      ],

    clean: function()
    {
      var W = this.bg.canvas.width;
      var H = this.bg.canvas.height;
      this.bg.fillRect(0, 0, W, H);
      this.fg.clearRect(0, 0, W, H);
      this.fg.strokeStyle = "white";
    },

    forward: function(d)
    {
      var W = this.fg.canvas.width / 2;
      var H = this.fg.canvas.height / 2;
      this.fg.beginPath();
      populus.log("moveTo({0}, {1})".fmt(W - this.x, H + this.y));
      this.fg.moveTo(W - this.x, H + this.y);
      var a = (this.heading * Math.PI / 180) - Math.PI / 2;
      this.x += d * Math.cos(a);
      this.y += d * Math.sin(a);
      populus.log("lineTo({0}, {1})".fmt(W - this.x, H + this.y));
      this.fg.lineTo(W - this.x, H + this.y);
      this.fg.stroke();
    },

    home: function() { this.set_position_heading(0, 0, 0); },

    set_position_head: function(x, y, heading)
    {
      this.x = x;
      this.y = y;
      this.heading = heading;
    },

    turn: function(incr) { this.heading += incr; },

  });

logo.init_canvas_turtle = function(bg, fg, active, proto)
{
  turtle = logo.canvas_turtle.$new(bg, fg, active, proto);

  // BACK dist
  // BK dist
  //   moves the turtle backward, i.e., exactly opposite to the direction
  //   that it's facing, by the specified distance.  (The heading of the
  //   turtle does not change.)
  logo.procedures.BACK = function(tokens, f)
  {
    logo.eval_number(tokens, function(dist) {
        turtle.forward(-dist.value);
        f(undefined, logo.$undefined.$new());
      }, f);
  };

  // CLEAN
  //   erases all lines that the turtle has drawn on the graphics window.
  //   The turtle's state (position, heading, pen mode, etc.) is not changed.
  logo.procedures.CLEAN = function(tokens, f)
  {
    turtle.clean();
    f(undefined, logo.$undefined.$new());
  };

  // FORWARD dist
  // FD dist
  //   moves the turtle forward, in the direction that it's facing, by
  //   the specified distance (measured in turtle steps).
  logo.procedures.FORWARD = function(tokens, f)
  {
    logo.eval_number(tokens, function(dist) {
        turtle.forward(dist.value);
        f(undefined, logo.$undefined.$new());
      }, f);
  };

  // HOME
  //   moves the turtle to the center of the screen.  Equivalent to
  //   SETPOS [0 0] SETHEADING 0.
  logo.procedures.HOME = function(tokens, f)
  {
    turtle.home();
    f(undefined, logo.$undefined.$new());
  };

  // LEFT degrees
  // LT degrees
  //   turns the turtle counterclockwise by the specified angle, measured
  //   in degrees (1/360 of a circle).
  logo.procedures.LEFT = function(tokens, f)
  {
    logo.eval_number(tokens, function(degrees) {
        turtle.turn(-degrees.value);
        f(undefined, logo.$undefined.$new());
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
        f(undefined, logo.$undefined.$new());
      }, f);
  };

  // SETPOS pos
	//   moves the turtle to an absolute position in the graphics window.  The
	//   input is a list of two numbers, the X and Y coordinates.
  logo.procedure.SETPOS = function(tokens, f)
  {
   // logo.eval_list(tokens, function(pos) {
   //   }, f);
  };

  return turtle;
}
