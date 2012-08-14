// Super Simple Scheme
// Derived from Norvig's lisp.py http://norvig.com/lispy.html

(function (sss) {
  "use strict";

  // Evaluate the expression x in an environment
  sss.eval = function (x, env) {
    if (typeof x === "string") {         // variable reference
      return env[x];
    } else if (typeof x === "number") {  // literal number
      return x;
    } else if (x[0] === "quote") {       // (quote exp)
      return x[1];
    } else if (x[0] === "if") {          // (if test conseq alt)
      return sss.eval(x[sss.eval(x[1], env) ? 2 : 3], env);
    } else if (x[0] === "set!") {        // (set! var exp)
      while (!(env.hasOwnProperty(x[1]))) {
        env = Object.getPrototypeOf(env);
      }
      env[x[1]] = sss.eval(x[2], env);
    } else if (x[0] === "define") {      // (define var exp)
      env[x[1]] = sss.eval(x[2], env);
    } else if (x[0] === "lambda") {      // (lambda (var*) exp)
      return function () {
        var env_ = Object.create(env);
        for (var i = 0, n = arguments.length; i < n; ++i) {
          env_[x[1][i]] = arguments[i];
        }
        return sss.eval(x[2], env_);
      };
    } else if (x[0] === "begin") {       // (begin exp*)
      for (var val, i = 1, n = x.length; i < n; ++i) {
        val = sss.eval(x[i], env);
      }
      return val;
    } else {                             // (f exp*)
      var exps = x.map(function (exp) {
        return sss.eval(exp, env);
      });
      var f = exps.shift();
      return f.apply(undefined, exps);
    }
  };

  sss.global = {
    "+": function (x, y) { return x + y; },
    "-": function (x, y) { return x - y; },
    "*": function (x, y) { return x * y; },
    "/": function (x, y) { return x / y; },
    not: function (x) { return !x; },
    "<": function (x, y) { return x < y; },
    "<=": function (x, y) { return x <= y; },
    ">": function (x, y) { return x > y; },
    ">=": function (x, y) { return x >= y; },
    "=": function (x, y) { return x == y; },
    "equal?": function (x, y) { return x == y },
    "eq?": function (x, y) { return x === y },  // TODO check this
    length: function (x) { return x.length; },
    cons: function (x, y) { return [x].concat(y) },
    car: function (x) { return x[0]; },
    cdr: function (x) { return x.slice(1); },
    append: function (x, y) { return x.concat(y) },
    list: function () { return Array.prototype.slice.call(arguments); },
    "list?": function (x) { return x instanceof Array },
    "null?": function (x) { return x.length === 0; },
    "symbol?": function (x) { return typeof x === "string" }
  };
  Object.getOwnPropertyNames(Math).forEach(function (m) {
    sss.global[m] = Math[m];
  });

  sss.tokenize = function (s) {
    return s.replace(/\(/g, " ( ").replace(/\)/g, " ) ")
      .replace(/^\s+/, "").replace(/\s+$/, "").split(/\s+/);
  };

  sss.read = function (tokens) {
    if (tokens.length === 0) {
      throw "Unexpected EOF from sequence of tokens";
    }
    var token = tokens.shift();
    if (token === "(") {
      var L = [];
      while (tokens[0] !== ")") {
        L.push(sss.read(tokens));
      }
      tokens.shift();
      return L;
    } else if (token === ")") {
      throw "Unexpected )";
    } else {
      var n = parseFloat(token);
      return isNaN(n) ? token : n;
    }
  };

  sss.to_string = function (exp) {
    return exp instanceof Array ?
      "(" + exp.map(sss.to_string).join(" ") + ")" : exp.toString();
  };

  (typeof global === "object" ? global : window).$ = function (s) {
    var v = sss.eval(sss.read(sss.tokenize(s)), sss.global);
    if (v !== undefined) {
      return sss.to_string(v);
    }
  };

}(typeof exports === "object" ? exports : window.sss = {}));
