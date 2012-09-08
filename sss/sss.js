// A version of Peter Norvig's lis.py (http://norvig.com/lispy.html) and
// lispy.py (http://norvig.com/lispy2.html) that compiles to Javascript

// TODO let
// TODO I/O (ports)
// TODO CPS conversion for TCO
// TODO call/cc

(function (sss) {
  "use strict";

  // Perl-like string formatting (use $0, $1... in the string, referring to
  // values passed as parameters)
  String.prototype.fmt = function () {
    var args = arguments;
    return this.replace(/\$(\d+)/g, function (s, p) {
      return args[p] === undefined || args[p] === null ? "" : args[p];
    });
  }

  function next_az(str) {
    if (str === "_") {
      return "_a";
    } else if (str[str.length - 1] === "z") {
      return next_az(str.substr(0, str.length - 1)) + "a";
    } else {
      return str.replace(/\w$/, function (c) {
        return String.fromCharCode(c.charCodeAt(0) + 1);
      });
    }
  };

  // Tokenizer
  sss.tokenize = function(s) {
    var tokens = [];
    while (true) {
      var m = s
        .match(/\s*(,@|[('`,)]|"(?:[\\].|[^\\"])*"|;.*|[^\s('"`,;)]*)(.*)/);
      if (m && m[1].length > 0 && m[1][0] !== ";") {
        tokens.push(m[1]);
        s = m[2];
      } else {
        return tokens;
      }
    }
  };

  // Translate Scheme vars to JS vars
  var vars = {
    next_var: 0,

    new_var: function (v, def) {
      var name = "_" + this.next_var.toString(36);
      ++this.next_var;
      this[v] = { name: name, def: def };
      return name;
    },

    to_var: function (v) {
      if (!(v in this)) {
        sss.vars.new_var(v);
      }
      return this[v].name;
    },

    unvar: function (name) {
      for (var v in this) {
        if (this[v] && this[v].name === name) {
          return v;
        }
      }
    }
  };

  sss.symbols = {};

  // Symbols
  // Get a symbol for a name, creating it if necessary
  sss.get_symbol = function (s) {
    if (!sss.symbols.hasOwnProperty(s)) {
      sss.symbols[s] = { symbol: s };
    }
    return sss.symbols[s];
  }

  sss.vars = Object.create(vars);

  var s_if = sss.get_symbol("if");
  var s_set = sss.get_symbol("set!");
  var s_define = sss.get_symbol("define");
  var s_define_macro = sss.get_symbol("define-macro");
  var s_lambda = sss.get_symbol("lambda");
  var s_begin = sss.get_symbol("begin");

  var quotes = {
    "'": sss.get_symbol("quote"),
    "`": sss.get_symbol("quasiquote"),
    ",": sss.get_symbol("unquote"),
    ",@": sss.get_symbol("unquotesplicing")
  };

  // Create an atom from a token value (#t/#f, string, number, symbol)
  function atom(token) {
    if (token === "#t") {
      return true;
    } else if (token === "#f") {
      return false;
    } else if (token[0] === '"') {
      return JSON.parse(token);
    } else {
      var n = parseFloat(token);
      return isNaN(n) ? sss.get_symbol(token) : n;
    }
  }

  function cons(x, xs) {
    return [x].concat(xs);
  }

  function is_pair(x) {
    return Array.isArray(x) && x.length !== 0;
  }

  var macros = {};

  function add_macro(name, f) {
    var symbol = sss.get_symbol(name);
    macros[name] = f;
  }

  add_macro("let", function () {
    var args = Array.prototype.slice.call(arguments);
    var x = cons(sss.symbols["let"], args);
    check(x, args.length > 1);
    var bindings = args[0];
    var body = args.slice(1);
    check(x, Array.isArray(bindings) && bindings.every(function (b) {
      return Array.isArray(b) && b.length === 2 && is_symbol(b[0]);
    }), "illegal binding list");
    var vars = bindings.map(function (b) { return b[0]; });
    var vals = bindings.map(function (b) { return b[1]; });
    return cons([s_lambda, vars].concat(body.map(expand)), vals.map(expand));
  });

  // Compile a parsed expression to Javascript. This produces an anonymous
  // function of two arguments, env (the top-level environment) and set (a
  // function to set values in the environment)
  sss.compile = function (x) {
    return new Function("symbols", "return $0;".fmt(sss.to_js(x, sss.vars)));
  };

  sss.parse = function (tokens) {
    return expand(read(tokens), true);
  };

  function check(x, p, message) {
    if (!p) {
      throw "Syntax error in $0: $1".fmt(sss.to_sexp(x),
          message || "wrong length");
    }
    return x;
  }

  function expand(x, toplevel) {
    if (!Array.isArray(x)) {
      return x;
    }
    check(x, x.length > 0);
    if (x[0] === quotes["'"]) {
      return check(x, x.length === 2);
    } else if (x[0] === quotes["`"]) {
      check(x, x.length === 2);
      return expand_quasiquote(x[1]);
    } else if (x[0] === s_if) {
      check(x, x.length === 3 || x.length === 4);
      return x.map(expand);
    } else if (x[0] === s_set) {
      check(x, x.length === 3);
      check(x, is_symbol(x[1]), "can only set! a symbol");
      return [s_set, x[1], expand(x[2])];
    } else if (x[0] === s_define || x[0] === s_define_macro) {
      check(x, x.length >= 3);
      var v = x[1];
      if (Array.isArray(v)) {
        var lambda = [s_lambda, v.slice(1)].concat(x.slice(2));
        return expand([s_define, v[0], lambda]);
      } else {
        check(x, x.length === 3);
        check(x, is_symbol(v), "can only define a symbol");
        var exp = expand(x[2]);
        if (x[0] === s_define_macro) {
          check(x, toplevel, "define-macro is only allowed at top level");
          var f = sss.compile(exp)(sss.symbols);
          check(x, typeof f === "function", "macro must be a function");
          macros[v.symbol] = f;
          return;
        }
        return [s_define, v, exp];
      }
    } else if (x[0] === s_begin) {
      return x.map(function (x_) {
        return expand(x_, toplevel);
      });
    } else if (x[0] === s_lambda) {
      check(x, x.length >= 3);
      var vars = x[1];
      check(vars, is_symbol(vars) ||
          (Array.isArray(vars) && vars.every(is_symbol)),
          "illegal lambda argument list");
      var body = x.slice(2);
      var exp = body.length === 1 ? body[0] : cons(s_begin, body);
      return [s_lambda, vars, expand(exp)];
    } else if (is_symbol(x[0]) && macros[x[0].symbol]) {
      return expand(macros[x[0].symbol].apply(x, x.slice(1)), toplevel);
    } else {
      return x.map(expand);
    }
  }

  function expand_quasiquote(x) {
    if (!is_pair(x)) {
      return [quotes["'"], x];
    }
    check(x, x[0] !== quotes[",@"], "cannot splice here");
    if (x[0] === quotes[","]) {
      check(x, x.length === 2);
      return x[1];
    } else if (is_pair(x[0]) && x[0][0] === quotes[",@"]) {
      check(x[0], x[0].length === 2);
      return [sss.get_symbol("append"), x[0][1],
        expand_quasiquote(x.splice(1))];
    } else {
      return [sss.get_symbol("cons"), expand_quasiquote(x[0]),
        expand_quasiquote(x.splice(1))];
    }
  }

  // Read a list of tokens and return an atom or a list suitable for compile()
  function read(tokens) {
    var read_ahead = function (token) {
      if (token === "(") {
        var list = [];
        while (true) {
          token = tokens.shift();
          if (token === ")") {
            return list;
          } else {
            list.push(read_ahead(token));
          }
        }
      } else if (token === ")") {
        throw "Unexpected )";
      } else if (quotes.hasOwnProperty(token)) {
        return [quotes[token], read(tokens)];
      } else if (token === undefined) {
        throw "Unexpected EOF";
      } else {
        return atom(token);
      }
    };
    return read_ahead(tokens.shift());
  };

  function is_symbol(x) {
    return typeof x === "object" && x.hasOwnProperty("symbol");
  }

  function quote_js(x) {
    if (Array.isArray(x)) {
      return "[" + x.map(quote_js).join(",") + "]";
    } else if (is_symbol(x)) {
      return "symbols[$0]".fmt(JSON.stringify(x.symbol));
    } else {
      return JSON.stringify(x);
    }
  }

  // Translate lisp forms to Javascript code to be passed to compile()
  sss.to_js = function(x, vars) {
    if (Array.isArray(x)) {
      if (x[0] === quotes["'"]) {
        return quote_js(x[1]);
      } else if (x[0] === s_if) {
        return "($0?($1):($2))".fmt(sss.to_js(x[1], vars),
            sss.to_js(x[2], vars), sss.to_js(x[3], vars) || "undefined");
      } else if (x[0] === s_set) {
        return "$0,$0=$1".fmt(vars.to_var(x[1].symbol), sss.to_js(x[2], vars));
      } else if (x[0] === s_define) {
        return "$0=$1,undefined".fmt(vars.new_var(x[1].symbol, true),
            sss.to_js(x[2], vars));
      } else if (x[0] === s_lambda) {
        var vars_ = Object.create(vars);
        var f = "function(";
        if (is_symbol(x[1])) {
          f += "){var $0=Array.prototype.slice.call(arguments);"
            .fmt(vars_.new_var(x[1].symbol));
        } else {
          f += x[1].map(function (s) {
            return vars_.new_var(s.symbol);
          }).join(",") + "){";
        }
        var body = sss.to_js(x[2], vars_);
        var defs = Object.keys(vars_).filter(function (k) {
          return !!vars_[k].def;
        }).map(function (k) {
          return vars_[k].name;
        });
        if (defs.length > 0) {
          f += "var $0;".fmt(defs.join(","));
        }
        return f + "return $0;}".fmt(body);
      } else if (x[0] === s_begin) {
        return x.slice(1).map(function (e) {
          return sss.to_js(e, vars);
        }).join(",");
      } else {
        var e = x.map(function (e) {
          return sss.to_js(e, vars);
        });
        return "$0($1)".fmt(e[0], e.slice(1).join(","));
      }
    } else if (is_symbol(x)) {
      return vars.to_var(x.symbol);
    } else if (typeof x === "string") {
      return JSON.stringify(x);
    } else if (typeof x === "undefined") {
      return "undefined";
    } else {
      return x.toString();
    }
  };

  // Translate a parsed expression back to an s-expression
  sss.to_sexp = function (x) {
    return Array.isArray(x) ?
      "(" + x.map(sss.to_sexp).join(" ") + ")" :
      typeof x === "function" ?
        "#function" :
        x === true ?
          "#t" :
          x === false ?
            "#f" :
            typeof x === "string" ?
              JSON.stringify(x) :
              typeof x === "undefined" ?
                "" :
                is_symbol(x) ? x.symbol : x.toString();
  };

  // Runtime environment

  var fold = Array.prototype.reduce;

  function primitives(p, f) {
    if (f) {
      global[sss.vars.new_var(p)] = f;
    } else {
      Object.keys(p).forEach(function (p_) {
        global[sss.vars.new_var(p_)] = p[p_];
      });
    }
  }

  primitives({
    "+": function () {
      return fold.call(arguments, function (x, y) { return x + y; }, 0);
    },
    "-": function () {
      return arguments.length === 0 ? 0 :
        arguments.length === 1 ? -arguments[0] :
        Array.prototype.slice.call(arguments, 1).reduce(function (x, y) {
          return x - y;
        }, arguments[0]);
    },
    "*": function () {
      return fold.call(arguments, function (x, y) { return x * y; }, 1);
    },
    "/": function (x, y) { return x / y; },
    not: function (x) { return !x; },
    ">": function (x, y) { return x > y; },
    ">=": function (x, y) { return x >= y; },
    "<": function (x, y) { return x < y; },
    "<=": function (x, y) { return x <= y; },
    "=": function (x, y) { return x === y; },
    length: function (x) { return x.length; },
    cons: cons,
    car: function (x) { return x[0]; },
    cdr: function (x) { return x.slice(1); },
    list: function () { return Array.prototype.slice.call(arguments); },
    append: function (x, y) { return x.concat(y); },
    "list?": function (x) { return Array.isArray(x); },
    "pair?": is_pair,
    "null?": function (x) { return Array.isArray(x) && x.length === 0; },
    "symbol?": is_symbol,
  });

  Object.getOwnPropertyNames(Math).forEach(function (m) {
    primitives(m, Math[m]);
  }, this);

  sss.eval = function (str) {
    return sss.compile(sss.parse(sss.tokenize(str)))(sss.symbols);
  };

  sss.eval("(define-macro and (lambda args (if (null? args) #t (if (= (length args) 1) (car args) `(if ,(car args) (and ,@(cdr args)) #f)))))");

}(typeof exports === "object" ? exports : window.sss = {}));
