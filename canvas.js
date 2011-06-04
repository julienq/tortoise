// Additional functions in the logo namespace for turtle graphics
// (browser-only, but maybe a node backend could be made to produce SVG or PNG
// offline?)
// This version uses canvas to draw, as opposed to SVG (but should have an SVG
// export anyway.)

logo.turtle = populus.object.create();

logo.canvas_turtle = logo.turtle.create({

    init: function(bg, fg, active, sprite)
    {
      var self = this.call_super("init");
      self.bg = bg.getContext ? bg.getContext("2d") : bg;
      self.fg = fg.getContext ? fg.getContext("2d") : fg;
      self.active = active.getContext ? active.getContext("2d") : active;
      self.sprite = sprite.getContext ? sprite.getContext("2d") : sprite;
      self.hidden = false;
      self.drawing = true;
      self.bg_color = "#ffffff";
      self.bg_color_surface = logo.new_word(7);
      self.color = "#000000";
      self.color_surface = logo.new_word(0);
      self.half_size = 8;
      self.pen_size = 1;
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
      this.bg.fillStyle = this.bg_color;
      this.bg.fillRect(0, 0, W, H);
      this.fg.clearRect(0, 0, W, H);
      this.active.clearRect(0, 0, W, H);
      this.set_pen_size(this.pen_size);
    },

    // Draw the turtle at the current position/heading in its canvas
    draw_self: function()
    {
      var context = this.sprite;
      var W = context.canvas.width / 2;
      var H = context.canvas.height / 2;
      context.clearRect(0, 0, W * 2, H * 2);
      if (!this.hidden) {
        context.save();
        context.translate(W, H);
        context.scale(1, -1);
        context.translate(this.x, this.y);
        context.rotate(populus.radians(-this.heading));
        context.beginPath();
        context.moveTo(-this.half_size, -this.half_size);
        context.lineTo(this.half_size, -this.half_size);
        context.lineTo(0, this.half_size);
        context.fillStyle = this.color;
        context.fill();
        context.restore();
      }
    },

    forward: function(d)
    {
      var W = this.active.canvas.width / 2;
      var H = this.active.canvas.height / 2;
      var a = Math.PI / 2 - populus.radians(this.heading);
      var x = this.x + d * Math.cos(a);
      var y = this.y + d * Math.sin(a);
      if (this.drawing) {
        this.active.save();
        this.active.translate(W, H);
        this.active.scale(1, -1);
        this.active.beginPath();
        this.active.moveTo(this.x, this.y);
        this.active.lineTo(x, y);
        this.active.strokeStyle = this.color;
        this.active.stroke();
        this.active.restore();
      }
      this.set_position(x, y);
    },

    // Get the color for a token, which can be either a color list, a color
    // number or a hex color (3 or 6 digit). TODO: rgba, named colors
    get_color: function(c)
    {
      var m;
      if (c.is_list && c.count === 3 &&
        c.value[0].is_number && c.value[0] >= 0 && c.value[0] <= 100 &&
        c.value[1].is_number && c.value[1] >= 0 && c.value[1] <= 100 &&
        c.value[2].is_number && c.value[2] >= 0 && c.value[2] <= 100) {
        return "rgb({0}, {1}, {2})".fmt(Math.round(c.value[0] * 2.55),
          Math.round(c.value[1] * 2.55), Math.round(c.value[2] * 2.55));
      } else if (c.is_integer) {
        var color = turtle.COLORS[c.value];
        if (color) return color;
      } else if (c.is_word &&
        (m = c.value.match(/^\#([0-9a-f]{3}(?:[0-9a-f]{3})?)$/i))) {
        return m[1];
      }
    },

    home: function()
    {
      this.x = 0;
      this.y = 0;
      this.heading = 0;
      this.draw_self();
    },

    set_bg_color: function(color, surface)
    {
      this.bg_color = color;
      this.bg_color_surface = surface;
      this.bg.fillStyle = this.bg_color;
      this.bg.fillRect(0, 0, this.bg.canvas.width, this.bg.canvas.height);
    },

    set_pen_color: function(color, surface)
    {
      this.color = color;
      this.color_surface = surface;
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

    set_pen_size: function(sz)
    {
      this.pen_size = sz;
      this.active.lineWidth = this.pen_size;
      this.active.lineCap = "round";
      this.active.lineJoin = "round";
    },

    set_position: function(x, y)
    {
      this.x = x;
      this.y = y;
      this.draw_self();
    },

    set_scrunch: function(xscale, yscale)
    {
      this.active.scale(xscale, -yscale);
    },

  });

logo.init_canvas_turtle = function(bg, fg, active, sprite)
{
  turtle = logo.canvas_turtle.$new(bg, fg, active, sprite);

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

  // BACKGROUND
  // BG
	//   outputs the graphics background color, either as a slot number or
  //   as an RGB list, whichever way it was set.  (See PENCOLOR.)
  logo.procedures.BACKGROUND = function(tokens, f)
  {
    // TODO
    f(undefined, logo.$undefined.$new());
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
        turtle.set_heading(turtle.heading - degrees.value);
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

  // PALETTE colornumber
  //   outputs a list of three nonnegative numbers less than 100 specifying
  //   the percent saturation of red, green, and blue in the color associated
  //   with the given number.
  logo.procedures.PALETTE = function(tokens, f)
  {
    logo.eval_integer(tokens, function(c) {
        var color = turtle.COLORS[c.value];
        if (color) {
          // TODO
          f(undefined, logo.new_word(color));
        } else {
          f(logo.error.$new("DOESNT_LIKE", c.show()));
        }
      }, f);
  };

  // PENCOLOR
  // PC
  //   outputs a color number, a nonnegative integer that is associated with
  //   a particular color, or a list of RGB values if such a list was used as
  //   the most recent input to SETPENCOLOR.
  logo.procedures.PENCOLOR = function(tokens, f)
  {
    f(undefined, turtle.color_surface);
  };

  // PENDOWN
  // PD
  //   sets the pen's position to DOWN, without changing its mode.
  logo.procedures.PENDOWN = function(tokens, f)
  {
    turtle.drawing = true;
    f(undefined, logo.$undefined.$new());
  };

  // PENDOWNP
  // PENDOWN?
  //   outputs TRUE if the pen is down, FALSE if it's up.
  logo.procedures.PENDOWNP = function(tokens, f)
  {
    f(undefined, logo.new_word(turtle.drawing));
  };

  // PENUP
  // PU
  //   sets the pen's position to UP, without changing its mode.
  logo.procedures.PENUP = function(tokens, f)
  {
    turtle.drawing = true;
    f(undefined, logo.$undefined.$new());
  };

  // PENSIZE
	//   outputs a list of two positive integers, specifying the horizontal
  //   and vertical thickness of the turtle pen.  (In some implementations,
  //   including wxWidgets, the two numbers are always equal.)
  // TODO we output just one number at the moment
  logo.procedures.PENSIZE = function(tokens, f)
  {
    f(undefined, logo.new_word(turtle.pen_size));
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
        turtle.set_heading(turtle.heading + degrees.value);
        f(undefined, logo.$undefined.$new());
      }, f);
  };

  // SETBACKGROUND colornumber.or.rgblist
  // SETBG colornumber.or.rgblist
  //   set the screen background color by slot number or RGB values.
  //   See SETPENCOLOR for details.
  logo.procedures.SETBACKGROUND = function(tokens, f)
  {
    logo.eval_token(tokens, function(c) {
        var color = turtle.get_color(c);
        if (color) {
          turtle.set_bg_color(color, c);
          f(undefined, logo.$undefined.$new());
        } else {
          f(logo.error.$new("DOESNT_LIKE", c.show()));
        }
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

  // SETPALETTE colornumber rgblist
	//   sets the actual color corresponding to a given number, if allowed by
  //   the hardware and operating system.  Colornumber must be an integer
  //   greater than or equal to 8.  (Logo tries to keep the first 8 colors
  //   constant.)  The second input is a list of three nonnegative numbers
  //   less than 100 specifying the percent saturation of red, green, and
  //   blue in the desired color.
  logo.procedures.SETPALETTE = function(tokens, f)
  {
    logo.eval_integer(tokens, function(num) {
        if (num.value >= 8) {
          logo.eval_token(tokens, function(c) {
              var color = turtle.get_color(c);
              if (color && !c.is_integer) {
                turtle.COLORS[num.value] = color;
                f(undefined, logo.$undefined.$new());
              } else {
                f(logo.error.$new("DOESNT_LIKE", c.show()));
              }
            });
        } else {
          f(logo.error.$new("DOESNT_LIKE", c.show()));
        }
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
  logo.procedures.SETPENCOLOR = function(tokens, f)
  {
    logo.eval_token(tokens, function(c) {
        var color = turtle.get_color(c);
        if (color) {
          turtle.set_pen_color(color, c);
          f(undefined, logo.$undefined.$new());
        } else {
          f(logo.error.$new("DOESNT_LIKE", c.show()));
        }
      }, f);
  },

  // SETPENSIZE size
  //   sets the thickness of the pen.  The input is either a single positive
  //   integer or a list of two positive integers (for horizontal and
  //   vertical thickness).  Some versions pay no attention to the second
  //   number, but always have a square pen.
  logo.procedures.SETPENSIZE = function(tokens, f)
  {
    logo.eval_number(tokens, function(size) {
        if (size.value > 0) {
          turtle.set_pen_size(size.value);
          f(undefined, logo.$undefined.$new());
        } else {
          f(logo.error.$new("DOESNT_LIKE", size.show()));
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
          f(logo.error.$new("DOESNT_LIKE", pos.show()));
        }
      }, f);
  };

  // SETSCRUNCH xscale yscale
	//   adjusts the aspect ratio and scaling of the graphics display.
  //   After this command is used, all further turtle motion will be
  //   adjusted by multiplying the horizontal and vertical extent of
  //   the motion by the two numbers given as inputs.  For example,
  //   after the instruction "SETSCRUNCH 2 1" motion at a heading of
  //   45 degrees will move twice as far horizontally as vertically.
  //   If your squares don't come out square, try this.  (Alternatively,
  //   you can deliberately misadjust the aspect ratio to draw an ellipse.)
  logo.procedures.SETSCRUNCH = function(tokens, f)
  {
    logo.eval_number(tokens, function(xscale) {
        logo.eval_number(tokens, function(yscale) {
            turtle.set_scrunch(xscale, yscale);
            f(undefined, logo.$undefined.$new());
          }, f);
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

  // SHOWNP
  // SHONW?
  //   outputs TRUE if the turtle is shown (visible), FALSE if the
  //   turtle is hidden.  See SHOWTURTLE and HIDETURTLE.
  logo.procedures.SHOWNP = function(tokens, f)
  {
    f(undefined, logo.new_word(!turtle.hidden));
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
