// Additional functions in the logo namespace for turtle graphics
// (browser-only, but maybe a node backend could be made to produce SVG or PNG
// offline?)
// This version uses canvas to draw, as opposed to SVG (but should have an SVG
// export anyway.)

logo.turtle = populus.object.create();

logo.canvas_turtle = logo.turtle.create({

    init: function(bg, fg, active)
    {
      var self = this.call_super("init");
      self.bg = bg.getContext ? bg.getContext("2d") : bg;
      self.fg = fg.getContext ? fg.getContext("2d") : fg;
      self.active = active.getContext ? active.getContext("2d") : active;
      self.hidden = false;
      self.drawing = true;
      self.color = "#ffffff";
      return self;
    },

    // Predefined colors (using X11 as a reference)
    COLORS: [
        "#000000", // 0 black
        "#0000ff", // 1 blue
        "#00ff00", // 2 green (X11: lime)
        "#00ffff", // 3 cyan (X11: aqua)
        "#ff0000", // 4 red
        "#ff00ff", // 5 magenta (X11: fuchsia)
        "#ffff00", // 6 yellow
        "#ffffff", // 7 white
        "#a52a2a", // 8 brown
        "#d2b48c", // 9 tan
        "#228b22", // 10 forest (X11: forestgreen)
        "#7fffd4", // 11 aqua (X11: aquamarine)
        "#fa8072", // 12 salmon
        "#800080", // 13 purple
        "#ffa500", // 14 orange
        "#808080", // 15 grey (X11: gray)
      ],

    clean: function()
    {
      var W = this.bg.canvas.width;
      var H = this.bg.canvas.height;
      this.bg.fillRect(0, 0, W, H);
      this.fg.clearRect(0, 0, W, H);
    },

    // Draw the turtle at the current position/heading in its canvas
    draw_self: function()
    {
      var context = this.active;
      var W = context.canvas.width / 2;
      var H = context.canvas.height / 2;
      context.clearRect(0, 0, W * 2, H * 2);
      if (!this.hidden) {
        context.save();
        context.translate(this.x, -this.y);
        context.beginPath();
        context.moveTo(W - 12, H);
        context.lineTo(W + 12, H);
        context.lineTo(W, H - 24);
        context.fillStyle = "#ff4040";
        context.fill();
        context.restore();
      }
    },

    forward: function(d)
    {
      var W = this.fg.canvas.width / 2;
      var H = this.fg.canvas.height / 2;
      var a = (this.heading * Math.PI / 180) - Math.PI / 2;
      var x = this.x + d * Math.cos(a);
      var y = this.y + d * Math.sin(a);
      if (this.drawing) {
        this.fg.beginPath();
        this.fg.moveTo(W - this.x, H + this.y);
        this.fg.lineTo(W - x, H + y);
        this.fg.strokeStyle = this.color;
        this.fg.stroke();
      }
      this.set_position(x, y);
    },

    home: function()
    {
      this.x = 0;
      this.y = 0;
      this.heading = 0;
      this.draw_self();
    },

    set_heading: function(h)
    {
      this.heading = h;
      this.draw_self();
    },

    set_hidden: function(p)
    {
      this.hidden = !!p;
      this.draw_self();
    },

    set_position: function(x, y)
    {
      this.x = x;
      this.y = y;
      this.draw_self();
    },

    turn: function(incr) { this.heading += incr; },

  });

logo.init_canvas_turtle = function(bg, fg, active, proto)
{
  turtle = logo.canvas_turtle.$new(bg, fg, active, proto);

  // ARC angle radius
  //   draws an arc of a circle, with the turtle at the center, with the
  //   specified radius, starting at the turtle's heading and extending
  //   clockwise through the specified angle.  The turtle does not move.
  logo.procedures.ARC = function(tokens, f)
  {
    // TODO
    f(undefined, logo.$undefined.$new());
  };

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

  // HEADING
  //   outputs a number, the turtle's heading in degrees.
  logo.procedures.HEADING = function(tokens, f)
  {
    f(undefined, logo.new_word(turtle.heading));
  };

  // HIDETURTLE
  // HT
  //   makes the turtle invisible.  It's a good idea to do this while
  //   you're in the middle of a complicated drawing, because hiding
  //   the turtle speeds up the drawing substantially.
  logo.procedures.HIDETURTLE = function(tokens, f)
  {
    turtle.set_hidden(true);
    f(undefined, logo.$undefined.$new());
  };

  // PENDOWN
  // PD
  //   sets the pen's position to DOWN, without changing its mode.
  logo.procedures.PENDOWN = function(tokens, f)
  {
    turtle.drawing = true;
    f(undefined, logo.$undefined.$new());
  };

  // PENUP
  // PU
  //   sets the pen's position to UP, without changing its mode.
  logo.procedures.PENUP = function(tokens, f)
  {
    turtle.drawing = true;
    f(undefined, logo.$undefined.$new());
  };

  // POS
  //   outputs the turtle's current position, as a list of two
  //   numbers, the X and Y coordinates.
  logo.procedures.POS = function(tokens, f)
  {
    var list = logo.list.$new();
    list.value.push(logo.new_word(turtle.x));
    list.value.push(logo.new_word(turtle.y));
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

  // SETHEADING degrees
  // SETH degrees
  //   turns the turtle to a new absolute heading.  The input is
  //   a number, the heading in degrees clockwise from the positive
  //   Y axis.
  logo.procedures.SETHEADING = function(tokens, f)
  {
    logo.eval_number(tokens, function(h) {
        turtle.set_heading(h.value);
        f(undefined, logo.$undefined.$new());
      }, f);
  };

  // SETPENCOLOR colornumber.or.rgblist
  // SETPC colornumber.or.rgblist
  //   sets the pen color to the given number, which must be a nonnegative
  //   integer.  (See colors above)
  //   but other colors can be assigned to numbers by the PALETTE command.
  //   Alternatively, sets the pen color to the given RGB values (a list of
  //   three nonnegative numbers less than 100 specifying the percent
  //   saturation of red, green, and blue in the desired color).
  // TODO rgblist + color literals (#hex)
  logo.procedures.SETPENCOLOR = function(tokens, f)
  {
    logo.eval_number(tokens, function(colornumber) {
        var color = turtle.COLORS[colornumber.value];
        if (color) {
          turtle.color = color;
          f(undefined, logo.$undefined.$new());
        } else {
          f(logo.err(logo.ERR_DOESNT_LIKE, colornumber.show()));
        }
      }, f);
  };

  // SETPOS pos
  //   moves the turtle to an absolute position in the graphics window.  The
  //   input is a list of two numbers, the X and Y coordinates.
  logo.procedures.SETPOS = function(tokens, f)
  {
    logo.eval_list(tokens, function(pos) {
        if (pos.count === 2 &&
          pos.value[0].is_number && pos.value[1].is_number) {
          turtle.set_position(pos.value[0].value, pos.value[1].value);
          f(undefined, logo.$undefined.$new());
        } else {
          f(logo.error(logo.ERR_DOESNT_LIKE, pos.show()));
        }
      }, f);
  };

  // SETX xcor
  //   moves the turtle horizontally from its old position to a new
  //   absolute horizontal coordinate.  The input is the new X
  //   coordinate.
  logo.procedures.SETX = function(tokens, f)
  {
    logo.eval_number(tokens, function(x) {
        turtle.set_position(x.value, turtle.y);
        f(undefined, logo.$undefined.$new());
      }, f);
  };

  // SETXY xcor ycor
  //   moves the turtle to an absolute position in the graphics window.  The
  //   two inputs are numbers, the X and Y coordinates.
  logo.procedures.SETXY = function(tokens, f)
  {
    logo.eval_number(tokens, function(x) {
        logo.eval_number(tokens, function(y) {
            turtle.set_position(x.value, y.value);
            f(undefined, logo.$undefined.$new());
          }, f);
      }, f);
  };

  // SETY ycor
  //   moves the turtle vertically from its old position to a new
  //   absolute vertical coordinate.  The input is the new Y
  //   coordinate.
  logo.procedures.SETY = function(tokens, f)
  {
    logo.eval_number(tokens, function(y) {
        turtle.set_position(turtle.x, y.value);
        f(undefined, logo.$undefined.$new());
      }, f);
  };

  // SHOWTURTLE
  // ST
  //   makes the turtle visible.
  logo.procedures.SHOWTURTLE = function(tokens, f)
  {
    turtle.set_hidden(false);
    f(undefined, logo.$undefined.$new());
  };

  return turtle;
}
