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
      if (this.down) {
        this.context.lineTo(this.cx, this.cy);
        this.context.clearRect(this.context.canvas.width,
            this.context.canvas.height);
        this.context.stroke();
      }
    },

    turn: function (dh) {
      var h = radtoh(this.th) + dh;
      this.th = htorad((360 + h) % 360);
    }
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
  };

}(window.logo = {}));
