/* Copyright © 2011, Julien Quint <julien@igel.co.jp>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *   • Redistributions of source code must retain the above copyright notice,
 *     this list of conditions and the following disclaimer.
 *   • Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *   • Neither the name of romulusetrem.us nor the names of its contributors
 *     may be used to endorse or promote products derived from this software
 *     without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE. */



// Bind the function f to the object x. Additional arguments can be provided to
// specialize the bound function.
if (typeof Function.prototype.bind !== "function") {
  Function.prototype.bind = function(x)
  {
    var f = this;
    var args = Array.prototype.slice.call(arguments, 1);
    return function()
    {
      return f.apply(x, args.concat(Array.prototype.slice.call(arguments)));
    }
  };
}

// Everything below is in the populus namespace, or exports if the file is
// imported by node
(function(populus) {

  // Not so simple format function for messages and templates. Use {0}, {1}...
  // as slots for parameters. Missing parameters are replaced with the empty
  // string. Alternatively, use named slots together with a hash table as the
  // first argument for named slots (e.g. "{ip}:{port}"
  //   .fmt({ ip: ..., port: ... }))
  // If the argument is a function, it will be evaluated in null context and is
  // passed the list of arguments as arguments.
  // TODO include full templating from spqr
  String.prototype.fmt = function()
  {
    var args = Array.prototype.slice.call(arguments);
    if (args.length === 1 && typeof args[0] === "object" &&
      !/{0((?:\.[\w:_-]+)*)}/.test(this)) {
      return this.replace(/{([\w:_-]+)((?:\.[\w:_-]+)*)}/g, function(_, p, d) {
        return args[0] === undefined || args[0][p] === undefined ? "" :
          populus.deref(args[0][p], d, args);
      });
    } else {
      return this.replace(/{(\d+)((?:\.[\w:_-]+)*)}/g, function(_, p, d) {
          return args[p] === undefined ? "" : populus.deref(args[p], d, args);
      });
    }

  };

  // Check that a string is a valid id
  populus.check_id = function(id)
  {
    return /^[A-Za-z:_][A-Za-z:_0-9.-]*$/.test(id);
  };

  // Chop the last character of the string if it is a new-line and return the
  // chopped string (the original string is left untouched)
  populus.chomp = function(str)
  {
    return str.replace(/\n$/, "");
  };

  // Clamp the value between min and max and return the clamped value
  populus.clamp = function(value, min, max)
  {
    return Math.max(min, Math.min(max, value));
  };

  // Dereferencing, as used by fmt, and also useful for templating. x is the
  // initial argument; d is the dereferencing chain (e.g., ".foo.bar.baz"),
  // args the list of arguments for function application in case x ends up
  // being a function.
  populus.deref = function(x, d, args)
  {
    if (d) {
      var derefs = d.split(".").splice(1);
      while (derefs.length > 0 && x) {
        var d_ = derefs.shift();
        x = typeof x === "object" && d_ in x ? x[d_] : "";
      }
    }
    return typeof x === "function" && x.apply ?
      x.apply(args[0] && args[0]._, args) : x;
  };

  // Generate an array of n elements by using the function f
  populus.generate_elements = function(n, f)
  {
    var a = [];
    for (var i = 0; i < n; ++i) a.push(f(i));
    return a;
  };

  // Add an event listener to object x. By convention use an @ prefix for event
  // names (e.g. "@change".) Handler can be a function that will be called
  // with the event object as the only parameter, or an object that provides a
  // function called handle_event; see "notify" below.
  populus.listen = function(x, name, handler)
  {
    if (!(name in x)) x[name] = [];
    x[name].push(handler);
  };

  // Normalize a value within the [min, max] interval to [0, 1]
  populus.normalize = function(value, min, max)
  {
    return (value - min) / (max - min);
  };

  // Send an event. The event is an object that has at least the fields
  // "source" and "name", and may have additional parameters.
  populus.notify = function(e)
  {
    if (!e.name || !e.source) return;
    if (e.name in e.source) e.source[e.name].forEach(function(x) {
        if (x.handle_event) {
          x.handle_event.call(x, e);
        } else {
          x(e);
        }
      });
  };

  // Compute the overlap between to ranges xa1-xa2 and xb1-xb2, return
  // undefined on no overlap, otherwise a 2-dimensional array
  populus.overlap = function(xa1, xa2, xb1, xb2)
  {
    return (xa2 >= xb1) && (xa1 <= xb2) ?
      [Math.max(xa1, xb1), Math.min(xa2, xb2)] : undefined;
  };

  // Return a random element from an array
  populus.random_element = function(a)
  {
    return a[populus.random_int(0, a.length - 1)];
  };

  // Generate a random id of the given length. This generates valid XML ID but
  // does not check that they already exist in the context of a document
  // Note: we don't use "." in id's because deref doesn't like it; maybe we
  // could change deref's syntax?
  populus.random_id = function(n)
  {
    var first = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm:_";
    var all = first + "1234567890-";
    var id = populus.random_element(first);
    for (var i = 1; i < n; ++i) id += populus.random_element(all);
    return id;
  };

  // Return a random integer in the [min, max] range
  populus.random_int = function(min, max)
  {
    return min + Math.floor(Math.random() * (max + 1 - min));
  };

  // Return a random number in the [min, max[ range
  populus.random_number = function(min, max)
  {
    return min + Math.random() * (max - min);
  };

  // Remap a value within the in interval to a value within the out interval
  populus.remap = function(value, min_in, max_in, min_out, max_out)
  {
    return min_out +
      populus.normalize(value, min_in, max_in) * (max_out - min_out);
  };

  // Return the -1 for negative numbers, +1 for positive numbers (0 is +1)
  populus.sign = function(n)
  {
    return isNan(n) ? NaN : x >= 0 ? 1 : -1;
  };

  // Shuffle an array and return a new array
  populus.shuffle = function(a)
  {
    var shuffled = typeof a === "string" ? a : a.slice(0);
    for (var i = shuffled.length - 1; i > 0; --i) {
      var j = populus.random_int(0, i);
      var x = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = x;
    }
    return shuffled;
  };

  // Execute function f n times.
  populus.times = function(n, f) { for (var i = 0; i < n; ++i) f(i); };

  // Remove the listener to object x.
  populus.unlisten = function(x, name, handler)
  {
    if (name in x) {
      var i = x[name].indexOf(handler);
      if (i >= 0) x[name].splice(i, 1);
    }
  };

  // Get all enumerable values from an object
  populus.values = function(o)
  {
    return Object.keys(o).map(function(x) { return o[x]; });
  };


  // Base object for prototype inheritance
  populus.$object =
  {
    // Same as populus.listen, with this object being the one whose events we
    // want to listen to
    add_listener: function(name, handler)
    {
      populus.listen(this, name, handler);
    },

    // Call the function named f on the superclass of this object. The rest of
    // the argument list is passed in the same manner as Function.call(); of
    // course "this" is maintained.
    // NOTE: the f argument is a *string*: it's the *name* of the function that
    // we want to call, not the function itself!
    call_super: function(f)
    {
      var g = this[f];
      if (g) {
        var key = "__super__" + f;
        var q = this[key];
        if (!q) {
          for (var p = this; p && !p.hasOwnProperty(f);
              p = Object.getPrototypeOf(p)) {
          }
        }
        for (p = Object.getPrototypeOf(q || p); p && !p.hasOwnProperty(f);
            p = Object.getPrototypeOf(p));
        if (p && p.hasOwnProperty(f)) {
          this[key] = p;
          var v = p[f].apply(this, Array.prototype.slice.call(arguments, 1));
          if (q) {
            this[key] = q;
          } else {
            delete this[key];
          }
          return v;
        }
      }
    },

    // Check whether this object inherits from the given prototype, directly or
    // indirectly
    is_a: function(proto)
    {
      for (var p = Object.getPrototypeOf(this); p && p !== proto;
          p = Object.getPrototypeOf(p));
      return !!(p && p === proto);
    },

    // Same as populus.notify, except that the object becomes the source by
    // default (so no need to pass it) and the name is passed as the first
    // argument, with (optional) additional arguments following
    notify: function(name, e)
    {
      if (typeof e !== "object") e = {};
      e.source = this;
      e.name = name;
      populus.notify(e);
    },
  };

})(typeof exports === "undefined" ? this.populus = {} : exports);


if (typeof Element !== "undefined") {
  // Additions to DOM Elements
  // The class stuff needs to be updated for SVGElements!

  // Append a class to an element (if it does not contain it already)
  Element.prototype.add_class = function(c)
  {
    var k = this.className;
    if (!this.has_class(c)) {
      this.className = "{0}{1}{2}".fmt(k, k ? " " : "", c);
    }
  };

  // Append a newly created text node as a child of the element
  Element.prototype.append_text = function(text)
  {
    this.appendChild(document.createTextNode(text));
  };

  // Similar to getBoundingClientRect() but returns coordinates in the page
  // (offset by the scrollTop/scrollLeft of the document body) rather than the
  // client.
  Element.prototype.getBoundingPageRect = function()
  {
    var bbox = Object.create(this.getBoundingClientRect());
    bbox.left += document.body.scrollLeft;
    bbox.right += document.body.scrollLeft;
    bbox.top += document.body.scrollTop;
    bbox.bottom += document.body.scrollTop;
    return bbox;
  };

  // Test whether an element has the given class
  Element.prototype.has_class = function(c)
  {
    return (new RegExp("\\b{0}\\b".fmt(c))).test(this.className);
  };

  // Get the nth child of a node
  Element.prototype.nth_child = function(index)
  {
    var nth = function(elem, n)
    {
      return n === 0 || elem === null ? elem : nth(elem.nextSibling, n - 1);
    };
    return nth(this.firstChild, index);
  };

  // Get the rect resulting of the overlap between the element's bounding box
  // and the given rect. If there is no overlap, return undefined. The
  // coordinates are given in page coordinates rather than client.
  Element.prototype.overlapping_rect = function(rect)
  {
    var bbox = this.getBoundingPageRect();
    var xo = populus.overlap(bbox.left, bbox.right, rect.left, rect.right);
    if (xo !== undefined) {
      var yo = populus.overlap(bbox.top, bbox.bottom, rect.top, rect.bottom);
      if (yo !== undefined) {
        return { left: xo[0], right: xo[1], top: yo[0], bottom: yo[1] };
      }
    }
  };

  // Get the pixel value of a CSS property
  Element.prototype.pixels = function(property)
  {
    try {
      return getComputedStyle(this, "").getPropertyCSSValue(property)
        .getFloatValue(CSSPrimitiveValue.CSS_PX);
    } catch(e) {
      return 0;
    }
  };

  // Remove all children of an element
  Element.prototype.remove_children = function()
  {
    var child = elem.firstElementChild;
    while (child) {
      var next = child.nextElementSibling;
      elem.removeChild(child);
      child = next;
    }
  };

  // Remove the given class from an element and return it. If it did not have
  // the class to start with, return an empty string.
  Element.prototype.remove_class = function(c)
  {
    var removed = "";
    this.className = this.className.replace(new RegExp("\\s*{0}\\b".fmt(c)),
        function(str) { removed = str; return ""; });
    return removed;
  };

  // Set the class c on the element if and only if the predicate p is true; so
  // if p is false, remove it.
  Element.prototype.set_class_iff = function(c, p)
  {
    this[(p ? "add" : "remove") + "_class"](c);
  };

  // Set the position (left, top) of an element (in pixels)
  Element.prototype.set_position = function(x, y)
  {
    this.style.left = "{0}px".fmt(x);
    this.style.top = "{0}px".fmt(typeof y === "number" ? y : x);
  };

  // Set the size (width, height) of an element (in pixels)
  Element.prototype.set_size = function(w, h)
  {
    this.style.width = "{0}px".fmt(w);
    this.style.height = "{0}px".fmt(typeof h === "number" ? h : w);
  };


  // Get clientX/clientY as an object { x: ..., y: ... } for events that may be
  // either a mouse event or a touch event, in which case the position of the
  // first touch is returned.
  populus.event_client_pos = function(e)
  {
    return { x: e.targetTouches ? e.targetTouches[0].clientX : e.clientX,
      y: e.targetTouches ? e.targetTouches[0].clientY : e.clientY };
  };

  // Get pageX/pageY as an object { x: ..., y: ... } for events that may be
  // either a mouse event or a touch event, in which case the position of the
  // first touch is returned. This is client position (clientX/clientY) offset
  // by the document body scroll position
  populus.event_page_pos = function(e)
  {
    var p = populus.event_client_pos(e);
    return { x: p.x + document.body.scrollLeft,
      y: p.y + document.body.scrollTop };
  };

  // Get the value for a key from local storage (if it exists) and return it
  // after parsing (set raw for a raw, unparsed value.) Return undefined when no
  // data was found or when storage is not even available.
  populus.get_from_storage = function(key, raw)
  {
    var data = undefined;
    if (window.localStorage) {
      data = localStorage.getItem(key);
      if (!raw) try { data = JSON.parse(data); } catch (e) {}
    }
    return data;
  };

  // Make an HTML element
  populus.html = function(tagname, attrs, content)
  {
    var element = document.createElement(tagname);
    if (typeof attrs === "object") {
      for (var a in attrs) element.setAttribute(a, attrs[a]);
    }
    if (content) {
      if (content.forEach) {
        content.forEach(element.appendChild.bind(element));
      } else {
        element.innerHTML = content;
      }
    }
    return element;
  }

  // Safe call to console.log (silent when the console is not present) with
  // "free" application of fmt as a bonus.
  populus.log = function(msg)
  {
    var args = Array.prototype.slice.call(arguments, 1);
    window.console && window.console.log(String.prototype.fmt
        .apply(msg.toString(), args));
  };

  // Simple XMLHttpRequest wrapper to do GET requests (when data === null) and
  // POST request (when there is data.) The callback f is called when the
  // readyState === 4.
  // TODO check encoding of params
  populus.xhr = function(url, params, data, f)
  {
    var req = new XMLHttpRequest();
    var p = Object.keys(params)
      .map(function(x) { return "{0}={1}".fmt(x, params[x]); })
      .join("&");
    req.open(data ? "POST" : "GET", "{0}{1}{2}".fmt(url, p ? "?" : "", p));
    if (data) req.setRequestHeader("Content-Type", "text/plain");
    req.onreadystatechange = function() { if (req.readyState === 4) f(req); };
    req.send(data);
  };

  // Simply echo the result of a request (for use with xhr)
  populus.xhr_result = function(req)
  {
    if (req.status === 200) {
      populus.log(req.responseText);
    } else {
      populus.log("XMLHttpRequest returned status {0}", req.status);
    }
  };


  // Some useful controllers

  // A push button; can be enabled, disabled, pushed. Sends an @activated event
  // when pushed and released.
  populus.$button = Object.create(populus.$object, {
      enabled: { enumerable: true, configurable: true,
          get: function() { return !this.elem.has_class("disabled"); },
          set: function(x) { this.elem.set_class_iff("disabled", !x); } },
      pushed: { enumerable: true, configurable: true,
          get: function() { return this.elem.has_class("pushed"); },
          set: function(x) { this.elem.set_class_iff("pushed", x); } },
    });

  // Create a button controller for a given element. It will receive a
  // disabled pushed class at some point. A new button is initially enabled.
  populus.button = function(elem, proto)
  {
    var o = Object.create(proto || populus.$button);
    o.elem = elem;
    o.enabled = true;
    o.pushed = false;
    elem.addEventListener("mousedown", o, false);
    elem.addEventListener("touchstart", o, false);
    elem.addEventListener("mouseout", o, false);
    elem.addEventListener("touchcancel", o, false);
    elem.addEventListener("mouseup", o, false);
    elem.addEventListener("touchend", o, false);
    return o;
  };

  // Handle mouse and touch events
  populus.$button.handleEvent = function(e)
  {
    e.preventDefault();
    if ((e.type === "mousedown" || e.type === "touchstart") && this.enabled) {
      this.pushed = true;
    } else if (e.type === "mouseout" || e.type === "touchcancel") {
      this.pushed = false;
    } else if ((e.type === "mouseup" || e.type === "touchup") && this.pushed) {
      this.pushed = false;
      this.notify("@activated");
    }
  };


  // A general purpose block; notably it can be moved, resized, edited, pushed
  // (like a button.)
  populus.$block = Object.create(populus.$object, {
      // Override can_move for finer control about the movable state of the
      // block
      can_move: { enumerable: true, configurable: true,
          get: function() { return this.movable; } },
    });

  // Delegate to help handle block movement
  populus.$block_delegate = Object.create(populus.$object);

  populus.block_delegate = function(proto)
  {
    var o = Object.create(proto || populus.$block_delegate);
    document.addEventListener("mousemove", o, false);
    document.addEventListener("mouseup", o, false);
    return o;
  }

  populus.default_block_delegate = populus.block_delegate();

  // Create a block with attributes "movable", "selectable", "editable",
  // "resizable", "pushable"
  populus.block = function(elem, attrs, proto)
  {
    var o = Object.create(proto || populus.$block);
    o.elem = elem;
    o.delegate = populus.default_block_delegate;
    if (!attrs) attrs = {};
    o.movable = !!attrs.movable;
    o.selectable = !!attrs.selectable;  // TODO
    o.editable = !!attrs.editable;      // TODO
    o.resizable = !!attrs.resizable;    // TODO
    o.pushable = !!attrs.pushable;      // TODO
    elem.addEventListener("mousedown", o, false);
    elem.addEventListener("touchstart", o, false);
    elem.addEventListener("touchmove", o.delegate, false);
    elem.addEventListener("touchend", o.delegate, false);
    return o;
  };

  // The block chooses which action to take when it gets a "down" event
  populus.$block.handleEvent = function(e)
  {
    e.preventDefault();
    if (this.can_move) this.delegate.block_start_moving(this, e);
  };

  // Delegate event handler
  populus.$block_delegate.handleEvent = function(e)
  {
    e.preventDefault();
    if (e.type === "mousemove" || e.type === "touchmove") {
      this.block_move(e);
    } else if (e.type === "mouseup" || e.type === "touchend") {
      this.block_up(e);
    }
  };

  // Start handling actions for a block
  populus.$block_delegate.block_start_moving = function(block, e)
  {
    if (this.current_block) throw "A block is already moving!";
    this.current_block = block;
    this.current_block.elem.add_class("moving");
    document.body.add_class("moving");
    this.offset = populus.event_page_pos(e);
    var x = this.current_block.elem.pixels("left");
    var y = this.current_block.elem.pixels("top");
    this.offset.x -= x;
    this.offset.y -= y;
    this.current_block.notify("@will-move", { pos: { x: x, y: y } });
  };

  // Keep moving
  populus.$block_delegate.block_move = function(e)
  {
    if (this.current_block) {
      var p = populus.event_page_pos(e);
      var x = p.x - this.offset.x;
      var y = p.y - this.offset.y;
      this.current_block.elem.set_position(x, y);
      this.current_block.notify("@moving", { pos: { x: x, y: y } });
    }
  };

  // Stop handling actions for the current block (if any)
  populus.$block_delegate.block_up = function(e)
  {
    if (this.current_block) {
      this.current_block.elem.remove_class("moving");
      document.body.remove_class("moving");
      this.offset = null;
      this.current_block.notify("@moved");
      this.current_block = null;
    }
  };

}
