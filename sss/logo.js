(function (logo) {
  "use strict";

  function htorad(h) {
    return (90 - h) / 180 * Math.PI;
  }

  function radtoh(th) {
    return (Math.PI / 2 - th) / Math.PI * 180;
  }

  var turtle = {
    init: function (canvas) {
      this.cx = canvas.width / 2;
      this.cy = canvas.height / 2;
      this.th = Math.PI / 2;
      this.down = true;
      this.context = canvas.getContext("2d");
      this.context.strokeStyle = "white";
      this.context.beginPath();
      this.context.moveTo(this.cx, this.cy);
      return this;
    },

    forward: function (dist) {
      this.cx += dist * Math.cos(this.th);
      this.cy -= dist * Math.sin(this.th);
      this.moved();
    },

    turn: function (dh) {
      var h = radtoh(this.th) + dh;
      this.th = htorad((360 + h) % 360);
    },

    get_x: function () {
      return this.cx - this.context.canvas.width / 2;
    },

    get_y: function () {
      return this.context.canvas.height / 2 - this.cy;
    },

    get_h: function () {
      return radtoh(this.th);
    },

    set_x: function (x) {
      this.cx = this.context.canvas.width / 2 + x;
      this.moved();
    },

    set_y: function (y) {
      this.cy = this.context.canvas.height / 2 - y;
      this.moved();
    },

    set_h: function (h) {
      this.th = htorad(h);
    },

    moved: function () {
      if (this.down) {
        this.context.lineTo(this.cx, this.cy);
        this.context.clearRect(this.context.canvas.width,
            this.context.canvas.height);
        this.context.stroke();
      } else {
        this.context.moveTo(this.cx, this.cy);
      }
    },
  };

  logo.turtle = function (canvas) {
    return Object.create(turtle).init(canvas);
  };

  logo.init_turtle_for_env = function (canvas, env) {
    var t = logo.turtle(canvas);
    env.fd = env.forward = t.forward.bind(t);
    env.bk = env.back = function (dist) { t.forward(-dist); };
    env.lt = env.left = function (dh) { t.turn(-dh); };
    env.rt = env.right = t.turn.bind(t);
    env.setx = t.set_x.bind(t);
    env.sety = t.set_y.bind(t);
    env.setxy = function (x, y) { t.set_x(x); t.set_y(y); };
    env.setpos = function (pos) { t.set_x(pos[0]); t.set_y(pos[1]); };
    env.seth = env.setheading = t.set_h.bind(t);
    env.home = function () { t.set_x(0); t.set_y(0); t.set_h(0); };
    env.pos = function () { return [t.get_x(), t.get_y()]; };
    env.xcor = t.get_x.bind(t);
    env.ycor = t.get_y.bind(t);
    env.heading = t.get_h.bind(t);
  };

}(window.logo = {}));
