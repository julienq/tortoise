// A version of Peter Norvig's lis.py (http://norvig.com/lispy.html) and
// lispy.py (http://norvig.com/lispy2.html) that compiles to Javascript

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
  }

  var symbol = {
    toString: function () {
      return "$0".fmt(this.symbol);
    }
  };

  sss.symbols = {};

  // Symbols
  // Get a symbol for a name, creating it if necessary
  sss.get_symbol = function (s) {
    if (!sss.symbols.hasOwnProperty(s)) {
      sss.symbols[s] = Object.create(symbol);
      sss.symbols[s].symbol = s;
    }
    return sss.symbols[s];
  }

  var s_if = sss.get_symbol("if");
  var s_set = sss.get_symbol("set!");
  var s_define = sss.get_symbol("define");
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

  // Compile a parsed expression to Javascript. This produces an anonymous
  // function of two arguments, env (the top-level environment) and set (a
  // function to set values in the environment)
  sss.compile = function (exp) {
    return new Function("env", "set", "symbols",
        "return $0;".fmt(sss.to_js(exp, "env")));
  };

  // Read a list of tokens and return an atom or a list suitable for compile()
  sss.read = function (tokens) {
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
        return [quotes[token], sss.read(tokens)];
      } else if (token === undefined) {
        throw "Unexpected EOF";
      } else {
        return atom(token);
      }
    };
    return read_ahead(tokens.shift());
  };

  function is_symbol(exp) {
    return typeof exp === "object" && exp.hasOwnProperty("symbol");
  }

  function quote_js(exp) {
    if (Array.isArray(exp)) {
      return "[" + exp.map(quote_js).join(",") + "]";
    } else if (is_symbol(exp)) {
      return "symbols[$0]".fmt(JSON.stringify(exp.symbol));
    } else {
      return JSON.stringify(exp);
    }
  }

  // Translate lisp forms to Javascript code to be passed to compile()
  sss.to_js = function(exp, env) {
    if (Array.isArray(exp)) {
      if (exp[0] === quotes["'"]) {
        return quote_js(exp[1]);
      } else if (exp[0] === s_if) {
        return "$0?$1:$2".fmt(sss.to_js(exp[1], env), sss.to_js(exp[2], env),
            sss.to_js(exp[3], env));
      } else if (exp[0] === s_set) {
        return "set($0,\"$1\",$2)".fmt(env, exp[1], sss.to_js(exp[2], env));
      } else if (exp[0] === s_define) {
        return "$0[\"$1\"]=$2,undefined".fmt(env, exp[1], sss.to_js(exp[2], env));
      } else if (exp[0] === s_lambda) {
        var f = "function(){var $0_=Object.create($0);".fmt(env);
        if (is_symbol(exp[1])) {
          f += "$0_[$1]=Array.prototype.slice.call(arguments);"
            .fmt(env, JSON.stringify(exp[1].symbol));
        } else {
          exp[1].forEach(function (v, i) {
            f += "$0_[\"$1\"]=arguments[$2];".fmt(env, v, i);
          });
        }
        return f + "return $0;}".fmt(sss.to_js(exp[2], env + "_"));
      } else if (exp[0] === s_begin) {
        return exp.slice(1).map(function (e) {
          return sss.to_js(e, env);
        }).join(",");
      } else {
        var e = exp.map(function (e) {
          return sss.to_js(e, env);
        });
        return "(function(f){return(typeof f===\"function\"?f:$0[f])($1);}($2))"
          .fmt(env, e.slice(1).join(","), e[0]);
      }
    } else if (is_symbol(exp)) {
      return "$0[\"$1\"]".fmt(env, exp.symbol);
    } else if (typeof exp === "string") {
      return JSON.stringify(exp);
    } else {
      return exp.toString();
    }
  };

  // Translate a parsed expression back to an s-expression
  sss.to_sexp = function (exp) {
    return Array.isArray(exp) ?
      "(" + exp.map(sss.to_sexp).join(" ") + ")" :
      typeof exp === "function" ?
        "#function" :
        exp === true ?
          "#t" :
          exp === false ?
            "#f" :
            typeof exp === "string" ?
              JSON.stringify(exp) :
              exp.toString();
  };

  // Runtime environment

  sss.env = {
    "+": function (x, y) { return x + y; },
    "-": function (x, y) { return x - y; },
    "*": function (x, y) { return x * y; },
    "/": function (x, y) { return x / y; },
    not: function (x) { return !x; },
    ">": function (x, y) { return x > y; },
    ">=": function (x, y) { return x >= y; },
    "<": function (x, y) { return x < y; },
    "<=": function (x, y) { return x <= y; },
    "=": function (x, y) { return x === y; },
    length: function (x) { return x.length; },
    cons: function (x, y) { return [x].concat(y); },
    car: function (x) { return x[0]; },
    cdr: function (x) { return x.slice(1); },
    list: function () { return Array.prototype.slice.call(arguments); },
    append: function (x, y) { return x.concat(y); },
    "list?": function (x) { return Array.isArray(x); },
    "null?": function (x) { return Array.isArray(x) && x.length === 0; },
    "symbol?": is_symbol,
  };

  Object.getOwnPropertyNames(Math).forEach(function (m) {
    sss.env[m] = Math[m];
  });

  sss.set = function (e, name, value) {
    if (e.hasOwnProperty(name)) {
      e[name] = value;
    } else if (e !== env) {
      set(Object.getPrototypeOf(e), name, value);
    }
  };

  sss.eval = function (str) {
    return sss.compile(sss.read(sss.tokenize(str)))(sss.env, sss.set,
      sss.symbols);
  };

}(typeof exports === "object" ? exports : window.sss = {}));
