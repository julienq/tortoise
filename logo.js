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

  // Bound version of reduce for processing array-like objects like arguments
  var reduce = Function.prototype.call.bind(Array.prototype.reduce);


  // Tokenizer

  // Tokens have a type (name, word, separator, error, dots, infix), a surface
  // value and a normalized value.
  logo.Token = {
    error: function (message) {
      throw "Error line %0 near %1: %2".fmt(this.line, this, message);
    },

    toString: function () {
      return (logo.format_token[this.type] || logo.format_token[""] ||
          logo.format_token).call(this);
    }
  };

  // Formatted output, to be overridden
  logo.format_token = function () {
    return this.value;
  };


  // TODO: check whether "foo~\nbar is the word foobar or foo~\nbar
  var tokenizer = logo.Tokenizer = {};

  tokenizer.init = function (line) {
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
  tokenizer.next_token = function () {
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
        if (this.input[this.i] === "\n") {
          ++this.line;
        }
      }
      if (this.i >= l) {
        return;
      }
      var c = this.input[this.i++];
      var token = Object.create(logo.Token);
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
          var j = this.tokens.length - 1;
          var i = this.i - 2;
          if ((j >= 0 && (this.tokens[j].type === "infix" ||
                  this.tokens[j].value === "(")) ||
              (i >= 0 && /\s/.test(this.input[i]) &&
               /\S/.test(this.input[this.i]))) {
            token.number = true;
            token.dotted = false;
            token.type = "name";
          } else {
            token.type = "infix";
            return token;
          }
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
          } else if (
              (this.list === 0 &&
                ((token.type === "word" &&
                  (/\s/.test(c) || c === "[" || c === "]" || c === "(") ||
                  c === ")") ||
                 (token.type !== "word" &&
                  (/\s/.test(c) || c === "[" || c === "]" || c === "(" ||
                   c === ")" || c === "{" || c === "}" || c === "+" ||
                   c === "-" || c === "*" || c === "/" || c === "=" ||
                   c === "<" || c === ">")))) ||
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
  tokenizer.tokenize = function (input, f) {
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

  // Tokens will inherit from symbols, kept in a symbol table.
  logo.Symbol = {
    error: function(message) {
      throw message;
    },

    // Null denotation; does not care about the token to its left. Used by
    // values and prefix operators.
    nud: function() {
      this.error("Undefined.");
    },

    // Left denotation; used by infix operators.
    led: function() {
      this.error("Missing operator.");
    }
  };

  logo.Scope = {
    define: function(n) {
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
      return n;
    },

    reserve: function(n) {
      if (n.arity !== "name" || n.reserved) {
        return;
      }
      var t = this.def[n.value];
      if (t) {
        if (t.reserved) {
          return;
        }
        if (t.arity === "name") {
          n.error("Already defined.");
        }
      }
      this.def[n.value] = n;
      n.reserved = true;
    }
  };

  function new_scope(parent_scope) {
    var scope = logo.Scope;
    scope.def = parent_scope ? Object.create(parent_scope.def) : {};
    return scope;
  }

  var parser = logo.Parser = {};

  parser.init = function (tokenizer) {
    this.symtab = {};
    this.symbol("]");
    this.symbol(")");
    this.symbol("(end)");
    this.symbol("(name)");
    this.symbol("(literal)").nud = self;
    // :foo means THING "foo
    this.symbol("(dots)").nud = function (parser) {
      var name = Object.create(this.symtab["(literal)"]);
      name.value = this.value;
      name.surface = this.surface;
      name.arity = "literal";
      return {
        arity: "call",
        value: parser.find_in_scope("THING"),
        args: [name]
      };
    };

    this.infix("=", 40, "EQUALP");
    this.infix("<", 40, "LESSP");
    this.infix(">", 40, "GREATERP");
    this.infix("<=", 40, "LESSEQUALP");
    this.infix(">=", 40, "GREATEREQUALP");
    this.infix("<>", 40, "NOTEQUALP");
    this.infix("+", 50, "SUM");
    this.infix("-", 50, "DIFFERENCE");
    this.infix("*", 60, "PRODUCT");
    this.infix("/", 60, "QUOTIENT");

    this.prefix("[", function(parser) {
      for (var list = { arity: "list", value: [] }; true;) {
        if (parser.token.id === "]") {
          parser.advance();
          break;
        } else if (parser.token.id === "(end)") {
          break;
        }
        list.value.push(parser.expression(0));
      }
      return list;
    });

    this.prefix("(", function(parser) {
      var expr = parser.expression(0);
      parser.advance(")");
      return expr;
    });

    this.prefix("to", function (parser) {
      // TODO
    });

    this.constant("TRUE", true);
    this.constant("FALSE", false);

    this.scope = this.root_scope = new_scope();
    this.tokenizer = tokenizer || Object.create(logo.Tokenizer).init();

    return this;
  };

  parser.find_in_scope = function (n) {
    return n in this.scope.def ? this.scope.def[n] :
      n in this.symtab ? this.symtab[n] : this.symtab["(name)"];
  }

  // Make a symbol from an id and an optional binding power (which defaults to
  // zero.) If the symbol already exists, update its binding power, otherwise
  // create a new one. Return the new or existing symbol.
  parser.symbol = function(id, bp) {
    bp = bp || 0;
    var s = this.symtab[id];
    if (s) {
      if (bp >= s.lbp) {
        s.lbp = bp;
      }
    } else {
      s = Object.create(logo.Symbol);
      s.id = s.value = id;
      s.lbp = bp;
      this.symtab[id] = s;
    }
    return s;
  };

  // Advance to the next token, possibly expecting an id
  parser.advance = function (id) {
    if (id && this.token.id !== id) {
      this.token.error("Expected “%0”.".fmt(id));
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
      o = this.find_in_scope(v);
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

  // Close the current scope
  parser.pop_scope = function () {
    this.scope = Object.getPrototypeOf(this.scope);
  };

  parser.expression = function(rbp) {
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
    s.led = function (parser, left) {
      return {
        arity: "infix",
        value: name,
        args: [left, parser.expression(bp)]
      };
    };
    return s;
  };

  parser.prefix = function(id, nud) {
    var s = this.symbol(id);
    s.nud = nud;
    return s;
  };

  parser.constant = function (s, v) {
    var x = this.symbol(s);
    x.nud = function (parser) {
      parser.scope.reserve(this);
      this.value = v;
      this.arity = "literal";
      return this;
    };
    x.value = v;
    return x;
  };

  // Parse a list of tokens and return a list of expressions
  parser.parse_tokens = function (tokens) {
    if (tokens) {
      this.i = 0;
      this.tokens = tokens;
      delete this.token;
      this.advance();
    }
    return this.expression(0);
  };

  //  Tokenizes, then parses the input and return a list of expressions.
  parser.parse = function (input, f) {
    var exprs = [];
    this.tokenizer.tokenize(input, function (prompt, tokens) {
      if (prompt === "?") {
        exprs.push(this.parse_tokens(tokens));
        while (this.i < this.tokens.length - 1) {
          exprs.push(this.parse_tokens());
        }
        f(prompt, exprs);
      } else {
        f(prompt);
      }
    }.bind(this));
  };


  var interpreter = logo.Interpreter = {};

  interpreter.init = function () {
    this.parser = logo.Parser.init();
    this.lib("DIFFERENCE", function (x, y) {
      return x - y;
    }, 2);
    this.lib("EQUALP", function (x, y) {
      return x === y;
    }, 2);
    this.alias("EQUALP", "EQUAL?");
    this.lib("PRODUCT", function (x, y) {
      return arguments.length === 2 ? x * y :
        reduce(arguments, function (x, y) {
          return x * y;
        }, 1);
    }, 2, 0, Infinity);
    this.lib("QUOTIENT", function (x, y) {
      return arguments.length === 2 ? x / y : 1 / x;
    }, 2, 1);
    this.lib("SUM", function (x, y) {
      return arguments.length === 2 ? x + y :
        reduce(arguments, function (x, y) {
          return x + y;
        }, 0);
    }, 2, 0, Infinity);
    this.lib("THING", function (name) {
      return this.find_in_scope(name).value;
    }, 1);
    return this;
  };

  interpreter.lib = function (name, f, arity, min, max) {
    this.parser.root_scope.define({
      value: name,
      "function": f,
      args: arity,
      min: typeof min === "number" ? min : arity,
      max: typeof max === "number" ? max : arity
    });
  };

  interpreter.alias = function (name, alias) {
    this.parser.root_scope.define(Object
        .create(this.parser.root_scope.def[name], {
          value: { value: alias, enumerable: true, writable: true }
        }));
  };

  interpreter.eval = function (input, f) {
    this.parser.parse(input, function (prompt, exprs) {
      if (prompt === "?") {
        f(prompt, exprs);
      } else {
        f(prompt);
      }
    });
  };

}(typeof exports === "object" ? exports : this.logo = {}));
