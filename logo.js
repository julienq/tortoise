var flexo = require("flexo");

// TODO arrays

// Create an empty, doubly-linked list
function empty_list()
{
  var list = Object.create({
    listp: true,

    toString: function()
    {
      for (var lp = this.first, out = []; lp !== null; lp = lp.tail) {
        out.push(lp.head.toString());
      }
      return "[" + out.join(" ") + "]";
    },

    append: function(x)
    {
      var last = { head: x, tail: null, prev: this.last };
      if (this.last) {
        this.last.tail = last;
      } else {
        this.first = last;
      }
      this.last = last;
      ++this.length;
      return this;
    },

    prepend: function(x)
    {
      var first = { head: x, tail: this.first, prev: null };
      if (this.first) {
        this.first.prev = first;
      } else {
        this.last = first;
      }
      this.first = first;
      ++this.length;
      return this;
    },

    butfirst: function()
    {
      // TODO copy on write
      return this.first && this.first.tail ? this.foldl.call(this.first.tail,
          function(l, x) { return l.append(x); }, empty_list()) :
        empty_list();
    },

    butlast: function()
    {
      return this.last && this.last.prev ? this.foldr.call(this.last.prev,
          function(x, l) { return l.prepend(x); }, empty_list()) :
        empty_list();
    },

    item: function(i)
    {
      if (i > 0) {
        for (var lp = this.first || this, j = 0; lp && j < i;
            lp = lp.tail, ++j);
      } else {
        for (var lp = this.last || this, j = -1; lp && j > i;
            lp = lp.prev, --j);
      }
      if (lp) return lp.head;
    },

    foldl: function(f, z)
    {
      for (var lp = this.first || this; lp; lp = lp.tail) z = f(z, lp.head);
      return z;
    },

    foldr: function(f, z)
    {
      for (var lp = this.last || this; lp; lp = lp.prev) z = f(lp.head, z);
      return z;
    },

    map: function(f)
    {
      return this.foldl(function(l, x) { return l.append(f(x)); }, empty_list(),
          this);
    },

    for_each: function(f)
    {
      for (var lp = this.first || this, i = 0; lp; lp = lp.tail, ++i) {
        f(lp.head, i, this);
      }
      return this;
    }

  });
  list.first = null;
  list.last = null;
  list.length = 0;
  return list;
}


exports.interpreter =
{
  init: function()
  {
    this.parser = Object.create(exports.parser).init();
    this.functions = {};
    var that = this;
    var eval_ = this.eval_expr.bind(this);

    // primitives

    this.add_primitive("WORD", 2, function(args, f) {
        f(flexo.foldl(function(x, y) { return x + y.toString(); },
          "", args));
      });

    this.add_primitive("LIST", 2, function(args, f) {
        f(flexo.foldl(function(l, x) { return l.append(x); },
          empty_list(), args));
      });

    this.add_primitive("SENTENCE", 2, function(args, f) {
        f(flexo.foldl(function(l, x) {
            return x.listp ? x.for_each(function(y) { l.append(y); }) :
              l.append(x);
          }, empty_list(), args));
      });
    this.add_primitive("SE", 2, this.functions.SENTENCE.f);

    this.add_primitive("FPUT", 2, 2, 2, function(args, f) {
        var thing = args[0];
        var list = args[1];
        if (list.listp) {
          f(list.prepend(thing));
        } else {
          // TODO check that thing is a 1-letter word
          f(that.functions.WORD.f.call(that, thing, list));
        }
      });

    this.add_primitive("LPUT", 2, 2, 2, function(args, f) {
        thing = args[0];
        list = args[1];
        if (list.listp) {
          f(list.append(thing));
        } else {
          f(that.functions.WORD.f.call(that, list, thing));
        }
      });

    this.add_primitive("FIRST", 1, 1, 1, function(thing) {
        thing = eval_(thing);
        if (thing.listp) {
          return thing.first.head;
        } else {
          return thing.toString().substr(0, 1);
        }
      });

    this.add_primitive("FIRSTS", 1, 1, 1, function(list) {
        return eval_(list).map(that.functions.FIRST.f);
      });

    this.add_primitive("LAST", 1, 1, 1, function(wordorlist) {
        var v = eval_(wordorlist);
        if (v.listp) {
          return v.last.head;
        } else {
          v = v.toString();
          return v[v.length - 1];
        }
      });

    this.add_primitive("BUTFIRST", 1, 1, 1, function(wordorlist) {
        var v = eval_(wordorlist);
        return v.listp ? v.butfirst() : v.toString().substr(1);
      });
    this.add_primitive("BF", 1, 1, 1, this.functions.BUTFIRST.f);

    this.add_primitive("BUTFIRSTS", 1, 1, 1, function(list) {
        return eval_(list).map(that.functions.BUTFIRST.f);
      });
    this.add_primitive("BFS", 1, 1, 1, this.functions.BUTFIRSTS.f);

    this.add_primitive("BUTLAST", 1, 1, 1, function(wordorlist) {
        var v = eval_(wordorlist);
        if (v.listp) {
          return v.butlast();
        } else {
          v = v.toString();
          return v.substr(0, v.length - 1);
        }
      });
    this.add_primitive("BL", 1, 1, 1, this.functions.BUTLAST.f);

    this.add_primitive("ITEM", 2, 2, 2, function(index, thing) {
        index = eval_(index);
        thing = eval_(thing);
        if (thing.listp) {
          return thing.item(index);
        } else {
          return thing[index];
        }
      });

    this.add_primitive("COUNT", 1, 1, 1, function(thing) {
        return eval_(thing).length;
      });

    this.add_primitive("PRINT", 1, function(args, f) {
        flexo.log("PRINT");
        flexo.async_map(eval_, args, function(args_) {
            that.print(args_.map(function(x) {
                var str = x.toString();
                return x.listp ? str.substr(1, str.length - 2) : str;
              }).join(" "));
            f();
          });
      });
    this.add_primitive("PR", 1, this.functions.PRINT.f);

    this.add_primitive("TYPE", 1, function() {
        this.type([].map.call(arguments, function(x) {
            var v = eval_(x);
            var str = v.toString();
            return v.listp ? str.substr(1, str.length - 2) : str;
          }).join(""));
      });
    this.add_primitive("PR", 1, this.functions.PRINT.f);

    this.add_primitive("SHOW", 1, function() {
        this.print([].map.call(arguments, function(x) {
            return eval_(x).toString();
          }).join(" "));
      });

    this.add_primitive("READLIST", 0, 0, 0, function(_, f) {
        that.read_line(function(line) {
            f(line);
          });
      });
    this.add_primitive("RL", 0, 0, 0, this.functions.READLIST.f);

    this.add_primitive("SUM", 2, function() {
        return flexo.foldl(function(x, y) { return x + eval_(y); }, 0,
          arguments);
      });

    this.add_primitive("DIFFERENCE", 2, 2, 2, function(x, y) {
        return eval_(x) - eval_(y);
      });

    this.add_primitive("MINUS", 1, 1, 1, function(x) { return -eval_(x); });

    this.add_primitive("PRODUCT", 2, function() {
        return flexo.foldl(function(x, y) { return x * eval_(y); }, 1,
          arguments);
      });

    this.add_primitive("WAIT", 1, 1, 1, function(args, f) {
        eval_(args[0], function(t) { setTimeout(f, t * 50 / 3); });
      });

    this.add_primitive("BYE", 0, 0, 0, function() { this.bye(); });

    return this;
  },

  add_primitive: function(name, n_args, min, max, f)
  {
    if (typeof min === "function") {
      f = min;
      min = 0;
      max = Infinity;
    }
    this.parser.add_function(name, n_args);
    this.functions[name] = { primitive: true, min: min, max: max, f: f };
  },

  eval_tokens: function(tokens, f)
  {
    flexo.log("eval_tokens", tokens);
    flexo.async_foreach.trampoline((function(g, expr, i, a) {
        flexo.log("async_forEach:", g, expr, i, a.length);
        this.eval_expr.bind(this).trampoline(expr, (function(v) {
            flexo.log("???");
            if (v) {
              this.warn("I don't know what to do with \"{0}\"".fmt(v));
            }
            return g.get_thunk();
          }).bind(this));
      }).bind(this), this.parser.parse_tokens(tokens), f);
  },

  // TODO: eval as string, integer, float...
  eval_expr: function(expr, f)
  {
    if (expr.arity === "call") {
      if (typeof this.functions[expr.value] === "object" &&
          typeof this.functions[expr.value].f === "function") {
        if (expr.args.length < this.functions[expr.value].min) {
          return f.get_thunk({ arity: "error",
            value: "Not enough arguments for {0}".fmt(expr.value) });
        } else if (expr.args.length > this.functions[expr.value].max) {
          return f.get_thunk({ arity: "error",
            value: "Too many arguments for {0}".fmt(expr.value) });
        } else {
          return ((function() {
              this.functions[expr.value].f.get_thunk(expr.args, f);
            }).bind(this)).get_thunk();
        }
      } else {
        return f.get_thunk({ arity: "error",
          value: "I don't know how to \"{0}\"".fmt(expr.value) });
      }
    } else if (expr.arity === "list") {
      return ((function() {
          this.functions.LIST.f.call(this, expr.value, f);
        }).bind(this)).get_thunk();
    } else {
      flexo.log("Value:", expr.value);
      return f.get_thunk(expr.value);
    }
  }
};


// TODO fix escaped newline
exports.tokenizer =
{
  init: function(line)
  {
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
  },

  // Get the next token or add to an already created token
  next_token: function()
  {
    var urtoken =
    {
      error: function(message)
      {
        throw "Error line {0} near {1}: {2}".fmt(this.line, this, message);
      },

      toString: function()
      {
        return this.type === "word" ?
          "\033[00;46m{0}\033[00m".fmt(this.value || " ") :
            this.type === "number" ? "\033[00;42m{0}\033[00m".fmt(this.value) :
            this.type === "error" ? "\033[00;41m{0}\033[00m".fmt(this.surface) :
            "\033[00;47m{0}\033[00m".fmt(this.value);
      }
    };

    this.tilda = false;
    this.comment = false;
    this.escaped = false;
    var l = this.input.length;
    var token;  // current token (may continue from leftover token)
    var begin;  // beginning of a line (start of input or following a newline)

    if (this.leftover) {
      // Continue reading token after line break (after a ~ or escaped newline)
      token = this.leftover;
      delete this.leftover;
    } else {
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
            token.value = "Unmatched \"{0}\"".fmt(c);
          }
          return token;
        } else if (c === "\"") {
          token.value = "";
          token.surface = c;
          token.type = "word";
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

    function add_c()
    {
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
      token.value += token.type === "word" ? c : c.toUpperCase();
      return true;
    }

    function check_number()
    {
      if (token.number) {
        delete token.number;
        delete token.dotted;
        var v = parseFloat(token.value);
        if (!isNaN(v)) {
          token.value = v;
          token.type = "number";
        }
      }
    }

    // Keep adding to the current token (name, word, comment)
    while (this.i < l) {
      c = this.input[this.i];
      if (this.escaped) {
        if (!add_c.call(this)) return token;
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
  },

  // Tokenize input and call a continuation with either a list of tokens or a
  // prompt for more tokens.
  // TODO handle END on its own line here
  tokenize: function(input, f)
  {
    this.i = 0;
    this.input = input;
    var token;
    do {
      token = this.next_token();
      if (token) this.tokens.push(token);
    } while (token);
    if (this.open.length === 0 && !this.leftover && !this.tilda) {
      var tokens = this.tokens.slice(0);
      this.tokens = [];
      f("?", tokens);
    } else {
      f(this.tilda ? "~" : this.escaped ? "\\" : this.bars ? "|" :
          this.open[this.open.length - 1] || "?");
    }
  }
};


// TODO fix infix (including parens)
// TODO error for functions with not enough input
exports.parser =
{
  init: function()
  {
    this.symtab = {};
    this.symbol("]");
    this.symbol(")");
    this.symbol("(end)");
    this.symbol("(name)");
    this.symbol("(literal)").nud = function() { return this; };

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

    var parser = this;

    this.prefix("[", function() {
        var list = { arity: "list", value: [] };
        while (true) {
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

    this.prefix("(", function() {
        var expr;
        if (parser.token.arity === "name") {
          expr = { arity: "call", value: parser.token.value, args: [] };
          parser.advance();
          while (true) {
            if (parser.token.id === ")") {
              parser.advance();
              break;
            } else if (parser.token.id === "(end)") {
              break;
            }
            if (expr.args) expr.args.push(parser.expression(0));
          }
        } else {
          expr = parser.expression(0);
          parser.advance(")");
        }
        return expr;
      });

    this.root_scope = this.new_scope();

    return this;
  },

  advance: function(id)
  {
    if (id && this.token.id !== id) this.token.error("Expected {0}.".fmt(id));
    if (this.i >= this.tokens.length) {
      this.token = this.symtab["(end)"];
      // console.log(">>> advance({0}): end of input = ".fmt(id || ""), this.token);
      return;
    }
    var t = this.tokens[this.i++];
    var v = t.value;
    var a = t.type;
    var o;
    if (a === "name") {
      o = this.scope.find(v);
    } else if (a === "infix" || a === "separator") {
      o = this.symtab[v];
      if (!o) {
        t.error("Unknown {0}."
            .fmt(a === "infix" ? "infix operator" : "separator"));
      }
    } else if (a === "word" || a === "number") {
      a = "literal";
      o = this.symtab["(literal)".fmt(a)];
    } else {
      t.error("Unexpected token.");
    }
    this.token = Object.create(o);
    this.token.value = v;
    this.token.surface = t.surface;
    this.token.arity = a;
    // console.log(">>> advance({0}): got {1}/{2} =".fmt(id || "", t, t.type), this.token);
  },

  symbol: function(id, bp)
  {
    bp = bp || 0;
    var s = this.symtab[id];
    if (s) {
      if (bp >= s.lbp) s.lbp = bp;
    } else {
      s = Object.create({
          error: function(message) { throw message; },
          nud: function() { this.error("Undefined."); },
          led: function(left) { this.error("Missing operator."); }
        });
      s.id = s.value = id;
      s.lbp = bp;
      this.symtab[id] = s;
    }
    return s;
  },

  new_scope: function(parent_scope)
  {
    var parser = this;
    var urscope =
    {
      define: function(n)
      {
        var t = this.def[n.value];
        if (typeof t === "object") {
          n.error(t.reserved ? "Already reserved." : "Already defined.");
        }
        this.def[n.value] = n;
        n.reserved = false;
        n.nud = function() { return this; };
        n.led = null;
        n.std = null;
        n.lbp = 0;
        n.scope = 0;
        return n;
      },

      find: function(n)
      {
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
      },

      pop: function() { parser.scope = this.parent; },

      reserve: function(n)
      {
        if (n.arity !== "name" || n.reserved) return;
        var t = this.def[n.value];
        if (t) {
          if (t.reserved) return;
          if (t.arity === "name") n.error("Already defined.");
        }
        this.def[n.value] = n;
        n.reserved = true;
      }
    };

    if (!parent_scope) parent_scope = this.scope;
    var scope = Object.create(urscope);
    scope.def = {};
    scope.parent = parent_scope;
    return scope;
  },

  expression: function(rbp)
  {
    // console.log("expression({0})".fmt(rbp));
    var t = this.token;
    this.advance();
    var left = t.nud();
    while (rbp < this.token.lbp) {
      // console.log("  got lbp = {0}, keep going".fmt(this.token.lbp));
      t = this.token;
      this.advance();
      left = t.led(left);
    }
    return left;
  },

  infix: function(id, bp, name)
  {
    var s = this.symbol(id, bp);
    var parser = this;
    s.led = function(left)
    {
      return { arity: "infix", value: name,
        args: [left, parser.expression(bp)] };
    };
    return s;
  },

  prefix: function(id, nud)
  {
    var s = this.symbol(id);
    s.nud = nud;
    return s;
  },

  // TODO check the binding power
  add_function: function(name, n)
  {
    var f = this.symbol(name);
    var parser = this;
    f.nud = function()
    {
      return { arity: "call", value: name,
        args: flexo.times(n, function() { return parser.expression(0); }) };
    }
    return f;
  },

  expressions: function()
  {
    var exprs = [];
    while (true) {
      if (this.token.id === "(end)") break;
      var e = this.token;
      if (e.nud) {
        this.advance();
        this.scope.reserve(e);
        exprs.push(e.nud());
      } else {
        exprs.push(this.expression(0));
      }
    }
    return exprs;
  },

  // Parse a list of tokens
  parse_tokens: function(tokens)
  {
    this.i = 0;
    this.tokens = tokens;
    delete this.token;
    this.scope = this.new_scope(this.root_scope);
    this.advance();
    return this.expressions();
  }
};
