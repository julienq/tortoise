(function (logo) {
  "use strict";

  // Simple format function for messages and templates. Use %0, %1... as slots
  // for parameters. %% is also replaced by %. Null and undefined are replaced
  // by an empty string.
  String.prototype.fmt = function () {
    var args = arguments;
    return this.replace(/%(\d+|%)/g, function (_, p) {
      return p === "%" ? "%" : args[p] == null ? "" : args[p];
    });
  };


  // Tokenizer

  var urtoken = {};

  urtoken.error = function (message) {
    throw "Error line %0 near %1: %2".fmt(this.line, this, message);
  };

  // Formatted output, to be overridden
  logo.format_token = {
    "": function () { return this.value; }
  };

  urtoken.toString = function () {
    var fmt = logo.format_token[this.type] || logo.format_token[""];
    return fmt.call(this);
  }

  var tokenizer = logo.tokenizer = {};

  tokenizer.init = function(line) {
    this.line = line || 0;
    this.open = [];
    this.list = 0;
    this.comment = false;
    this.tilda = false;
    this.escaped = false;
    this.bars = false;
    this.input = "";
    this.tokens = [];
    this.i = 0;
    return this;
  };

  // Get the next token or add to an already created token
  tokenizer.next_token = function() {
    this.tilda = false;
    this.comment = false;
    this.escaped = false;
    var l = this.input.length;
    var token;  // current token (may continue from leftover token)
    var begin;  // beginning of a line (start of input or following a newline)

    if (this.leftover) {
      // Continue reading token after line break (after a ~ or escaped newline)
      if (this.leftover.hasOwnProperty("value")) {
        token = this.leftover;
      }
      delete this.leftover;
    }
    if (!token) {
      // Look for a new token
      for (; this.i < l && /\s/.test(this.input[this.i]); ++this.i) {
        if (this.input[this.i] === "\n") ++this.line;
      }
      if (this.i >= l) return;
      var c = this.input[this.i++];
      var token = Object.create(urtoken);
      token.line = this.line + 1;
      if ((this.i === 1 || this.input[this.i - 2] === "\n") &&
          c === "#" && this.input[this.i] === "!") {
        this.comment = true;
        ++this.i;
      } else if (c === ";") {
        this.comment = true;
      } else if (c === "~" && this.input[this.i] === "\n") {
        ++this.i;
        ++this.line;
        this.tilda = true;
        return;
      } else if (c === "\\" && this.i < l) {
        this.escaped = true;
        token.surface = c;
        token.value = "";
        token.type = "name";
      } else if (c === "|") {
        this.bars = true;
        token.surface = c;
        token.value = "";
        token.type = this.list > 0 ? "word" : "name";
        if (this.list > 0) {
          token.number = true;
          token.dotted = false;
        }
      } else if (c === "[") {
        this.open.push(c);
        ++this.list;
        token.type = "separator";
        token.value = token.surface = c;
        return token;
      } else if (c === "]") {
        var open = this.open.pop();
        if (open === "[") {
          --this.list;
          token.type = "separator";
          token.value = token.surface = c;
        } else {
          token.type = "error";
          token.surface = c;
          token.value = "Unmatched \"]\"";
        }
        return token;
      } else if (this.list === 0) {
        if (c === "(" || c === "{") {
          this.open.push(c);
          token.type = "separator";
          token.value = token.surface = c;
          return token;
        } else if (c === ")" || c === "}") {
          var open = this.open.pop();
          if ((open === "(" && c === ")") || (open === "{" && c === "}")) {
            token.type = "separator"
            token.value = token.surface = c;
          } else {
            token.type = "error";
            token.surface = c;
            token.value = "Unmatched \"%0\"".fmt(c);
          }
          return token;
        } else if (c === "\"") {
          token.value = "";
          token.surface = c;
          token.type = "word";
          token.number = true;
          token.dotted = false;
        } else if (c === ":") {
          token.value = "";
          token.surface = c;
          token.type = "dots";
          token.number = true;
          token.dotted = false;
        } else if (c === "-") {
          token.value = token.surface = c;
          token.number = true;
          token.dotted = false;
          token.type = "name";
        } else if (c === "<") {
          if (this.input[this.i] === "=" || this.input[this.i] === ">") {
            c += this.input[this.i++];
          }
          token.value = token.surface = c;
          token.type = "infix";
          return token;
        } else if (c === ">") {
          if (this.input[this.i] === "=") c += this.input[this.i++];
          token.value = token.surface = c;
          token.type = "infix";
          return token;
        } else if (c === "+" || c === "*" || c === "/" || c === "=") {
          // note that "-" is handled as a number at the moment
          token.value = token.surface = c;
          token.type = "infix";
          return token;
        } else {
          token.value = c.toUpperCase();
          token.surface = c;
          token.number = true;
          token.dotted = c === ".";
          token.type = "name";
        }
      } else {
        token.value = c;
        token.surface = c;
        token.type = "word";
      }
    }

    var add_c = function () {
      var ok = true;
      if (token.number) {
        if (c === ".") {
          if (token.dotted) {
            delete token.number;
            delete token.dotted;
            ok = token.surface[0] !== "-";
          } else {
            token.dotted = true;
          }
        } else if (!/\d/.test(c)) {
          delete token.number;
          delete token.dotted;
          ok = token.surface[0] !== "-";
        }
      }
      if (!ok) {
        if (token.surface.length > 1) {
          this.leftover = { type: token.type, surface: token.surface.substr(1),
            value: token.value.substr(1), line: token.line };
        }
        token.value = token.surface = "-";
        token.type = "infix";
        return false;
      }
      token.surface += c;
      token.value += token.type === "word" || token.type === "dots" ? c :
        c.toUpperCase();
      return true;
    };

    var check_number = function () {
      if (token.number) {
        delete token.number;
        delete token.dotted;
        var v = parseFloat(token.value);
        if (!isNaN(v)) {
          token.value = v;
          token.type = "number";
        }
      }
    };

    // Keep adding to the current token (name, word, comment)
    while (this.i < l) {
      c = this.input[this.i];
      if (this.escaped) {
        if (!add_c.call(this)) {
          return token;
        }
        if (c === "\n" && this.i === l - 1) {
          ++this.line;
          this.leftover = token;
          return;
        } else {
          this.escaped = false;
        }
      } else if (this.bars) {
        if (c === "|") {
          token.surface += c;
          this.bars = false;
        } else if (c === "\\" && this.i < l - 1) {
          token.surface += c;
          this.escaped = true;
        } else {
          if (!add_c.call(this)) return token;
          if (c === "\n" && this.i === l - 1) {
            ++this.line;
            this.leftover = token;
            return;
          }
        }
      } else {
        if (c === "~" && this.input[this.i + 1] === "\n") {
          ++this.i;
          ++this.line;
          this.tilda = true;
          this.leftover = token;
          return;
        }
        if (!this.comment) {
          if (c === ";") {
            this.comment = true;
            this.leftover = token;
          } else if (c === "\\" && this.i < l - 1) {
            this.escaped = true;
            token.surface += c;
          } else if (c === "|") {
            this.bars = true;
            this.surface += c;
          } else if (this.list === 0 && (/\s/.test(c) || c === "[" ||
                c === "]" || c === "(" || c === ")" || c === "{" || c === "}" ||
                c === "+" || c === "-" || c === "*" || c === "/" || c === "=" ||
                c === "<" || c === ">") ||
              (this.list > 0 && (/\s/.test(c) || c === "[" || c === "]"))) {
            check_number();
            return token;
          } else {
            if (!add_c.call(this)) return token;
          }
        }
      }
      ++this.i;
    }
    if (token.type && !this.tilda && !this.escaped && !this.bars) {
      delete this.leftover;
      check_number();
      return token;
    }
  };

  // Tokenize input and call a continuation with either a list of tokens or a
  // prompt for more tokens.
  // TODO handle END on its own line here
  tokenizer.tokenize = function(input, f) {
    this.i = 0;
    this.input = input;
    var token;
    do {
      token = this.next_token();
      if (token) {
        this.tokens.push(token);
      }
    } while (token);
    if (this.open.length === 0 && !this.leftover && !this.tilda) {
      var tokens = this.tokens.slice(0);
      this.tokens = [];
      f("?", tokens);
    } else {
      f(this.tilda ? "~" : this.escaped ? "\\" : this.bars ? "|" :
          this.open[this.open.length - 1] || "?");
    }
  };


  // Parser
  // Cf. http://javascript.crockford.com/tdop/tdop.html

  function self() {
    return this;
  }

  var urscope = {};

  urscope.define = function(n) {
    var t = this.def[n.value];
    if (typeof t === "object") {
      n.error(t.reserved ? "Already reserved." : "Already defined.");
    }
    this.def[n.value] = n;
    n.reserved = false;
    n.nud = self;
    n.led = null;
    n.std = null;
    n.lbp = 0;
    n.scope = 0;
    return n;
  };

  urscope.find = function(parser, n) {
    var e = this;
    var o;
    while (true) {
      o = e.def[n];
      if (o && typeof o !== "function") return e.def[n];
      e = e.parent;
      if (!e) {
        o = parser.symtab[n];
        return o && typeof o !== "function" ? o : parser.symtab["(name)"];
      }
    }
  };

  urscope.reserve = function(n) {
    if (n.arity !== "name" || n.reserved) return;
    var t = this.def[n.value];
    if (t) {
      if (t.reserved) return;
      if (t.arity === "name") n.error("Already defined.");
    }
    this.def[n.value] = n;
    n.reserved = true;
  }

  function new_scope(parent_scope) {
    var scope = Object.create(urscope);
    scope.def = {};
    scope.parent = parent_scope;
    return scope;
  }

  var parser = logo.parser = {};

  parser.init = function () {
    this.symtab = {};
    this.symbol("]");
    this.symbol(")");
    this.symbol("(end)");
    this.symbol("(name)").nud = function () {
      // Handle parens
      return this;
    };
    this.symbol("(literal)").nud = self;
    this.symbol("(dots)").nud = function (parser) {
      var name = Object.create(this.symtab("(literal)"));
      name.value = this.value;
      name.surface = this.surface;
      name.arity = "literal";
      return {
        arity: "call",
        value: parser.scope.find(parser, "THING"),
        args: [name]
      };
    };
    this.infix("+", 50, "SUM");
    this.infix("-", 50, "DIFFERENCE");
    this.infix("*", 60, "PRODUCT");
    this.infix("/", 60, "QUOTIENT");
    this.infix("=", 40, "EQUALP");
    this.infix("<", 40, "LESSP");
    this.infix(">", 40, "GREATERP");
    this.infix("<=", 40, "LESSEQUALP");
    this.infix(">=", 40, "GREATEREQUALP");
    this.infix("<>", 40, "NOTEQUALP");

    this.prefix("[", function(parser) {
      for (var list = { arity: "list", value: [] }; true;) {
        if (parser.token.id === "]") {
          parser.advance();
          break;
        } else if (parser.token.id === "(end)") {
          break;
        }
        list.value.push(parser.parse_expression(0));
      }
      return list;
    });

    this.prefix("(", function(parser) {
      var expr = parser.parse_expression(0);
      parser.advance(")");
      return expr;
    });

    this.root_scope = new_scope();
    return this;
  };

  // Parse a list of tokens and return a list of expressions
  parser.parse_tokens = function(tokens) {
    this.i = 0;
    this.tokens = tokens;
    delete this.token;
    this.scope = new_scope(this.root_scope);
    this.advance();
    return this.parse_expression(0);
    // return this.parse_expressions();
  }

  // Advance to the next token, possibly expecting an id
  parser.advance = function (id) {
    if (id && this.token.id !== id) {
      this.token.error("Expected '%0'.".fmt(id));
    }
    if (this.i >= this.tokens.length) {
      this.token = this.symtab["(end)"];
      return;
    }
    var t = this.tokens[this.i++];
    var v = t.value;
    var a = t.type;
    var o;
    if (a === "name") {
      o = this.scope.find(this, v);
    } else if (a === "infix" || a === "separator") {
      o = this.symtab[v];
      if (!o) {
        t.error("Unknown %0."
            .fmt(a === "infix" ? "infix operator" : "separator"));
      }
    } else if (a === "word" || a === "number") {
      a = "literal";
      o = this.symtab["(literal)"];
    } else {
      t.error("Unexpected token.");
    }
    this.token = Object.create(o);
    this.token.value = v;
    this.token.surface = t.surface;
    this.token.arity = a;
  };

  // Create a new symbol with given id and binding power
  parser.symbol = function(id, bp) {
    bp = bp || 0;
    var s = this.symtab[id];
    if (s) {
      if (bp >= s.lbp) {
        s.lbp = bp;
      }
    } else {
      s = Object.create({
        error: function(message) {
          throw message;
        },
        nud: function() {
          this.error("Undefined.");
        },
        led: function() {
          this.error("Missing operator.");
        }
      });
      s.id = s.value = id;
      s.lbp = bp;
      this.symtab[id] = s;
    }
    return s;
  };

  parser.parse_expression = function(rbp) {
    var t = this.token;
    this.advance();
    var left = t.nud(this);
    while (rbp < this.token.lbp) {
      t = this.token;
      this.advance();
      left = t.led(this, left);
    }
    return left;
  };

  parser.infix = function(id, bp, name) {
    var s = this.symbol(id, bp);
    var parser = this;
    s.led = function (parser, left) {
      return {
        arity: "infix",
        value: name,
        args: [left, parser.parse_expression(bp)]
      };
    };
    return s;
  };

  parser.prefix = function(id, nud) {
    var s = this.symbol(id);
    s.nud = nud;
    return s;
  };

  // TODO check the binding power
  parser.add_function = function(name, n) {
    var f = this.symbol(name);
    var parser = this;
    f.nud = function (parser) {
      return {
        arity: "call",
        value: name,
        args: flexo.times(n, function() { return parser.parse_expression(0); })
      };
    }
    return f;
  };

  parser.parse_expressions = function() {
    for (var exprs = []; true;) {
      if (this.token.id === "(end)") {
        break;
      }
      var e = this.token;
      if (e.nud) {
        this.advance();
        this.scope.reserve(e);
        exprs.push(e.nud(parser));
      } else {
        exprs.push(this.parse_expression(0));
      }
    }
    return exprs;
  };

}(typeof exports === "object" ? exports : this.logo = {}));
