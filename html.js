(function (ui) {
  "use strict";

  logo.format_token = {
    "": function () {
      return "<span class=\"token\">%0</span>".fmt(this.value);
    },
    dots: function () {
      return "<span class=\"token dots\">%0</span>".fmt(this.value || " ");
    },
    error: function () {
      return "<span class=\"token error\">%0</span>".fmt(this.surface);
    },
    "number": function () {
      return "<span class=\"token number\">%0</span>".fmt(this.value);
    },
    word: function () {
      return "<span class=\"token word\">%0</span>".fmt(this.value || " ");
    }
  };

  ui.Term = {
    init: function (div) {
      this.div = div;
      this.input = div.querySelector("input");
      this.last = this.input.parentNode;
      this.pspan = this.last.querySelector("span");
      this.input.addEventListener("keyup", this);
      this.history = [];
      return this;
    },

    focus: function () {
      this.input.focus();
      return this;
    },

    handleEvent: function (e) {
      if (e.type === "keyup") {
        if (e.keyCode === 13) {
          var val = this.input.value;
          if (val !== "" && val !== this.history[this.history.length - 1]) {
            this.history.push(val);
          }
          this.i = this.history.length;
          this.input.value = "";
          this.oninput(val);
          this.input.scrollIntoView();
        } else if (e.keyCode === 38) {
          // up, go back in history
          this.i = Math.max(this.i - 1, 0);
          if (this.history[this.i]) {
            this.input.value = this.history[this.i];
            e.preventDefault();
          }
        } else if (e.keyCode === 40) {
          // down, go forward in history
          this.i = Math.min(this.i + 1, this.history.length);
          if (this.history[this.i]) {
            this.input.value = this.history[this.i];
            e.preventDefault();
          }
        }
      }
    },

    output: function (elem) {
      if (typeof elem === "string") {
        var p = this.div.ownerDocument.createElement("p");
        p.innerHTML = elem;
        elem = p;
      }
      this.div.insertBefore(p, this.last);
    },

    oninput: function () {
    }
  };

  Object.defineProperty(ui.Term, "prompt", {
    enumerable: true,
    get: function () {
      return this.pspan.innerHTML;
    },
    set: function (p) {
      this.pspan.innerHTML = p;
    }
  });

  function tokenizer() {
    var tokenizer = Object.create(logo.Tokenizer).init();
    var term = Object.create(ui.Term).init(document.querySelector(".term"));
    term.prompt = "?";
    term.oninput = function (input) {
      tokenizer.tokenize(input + "\n", function (prompt, tokens) {
        if (tokens) {
          term.output(tokens.join(" "));
        }
        term.prompt = prompt;
      });
    };
    term.focus();
  }

  tokenizer();

  /*
  var interpreter = Object.create(logo.Interpreter).init();

  var term = Object.create(ui.Term).init(document.querySelector(".term"));
  term.prompt = "?";
  term.oninput = function (input) {
    interpreter.eval(input, function (prompt, values) {
      if (values) {
        values.forEach(function (value) {
          term.output(value);
        });
      }
      term.prompt = prompt;
    });
  };
  term.focus();

  */


}(window.ui = {}));
