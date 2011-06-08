// TODO:
//   * parens/slurp
//   * infix
//   * function declaration
//   * vbarred

var populus = require("populus");

function error(message)
{
  return { message: message, is_error: true };
}

// Token stream is a wrapper around a string since strings are immutable in JS
var token_stream = populus.object.create({

  init: function(str)
  {
    var self = this.call_super("init");
    self.value = str;
    self.ended = !str.length;
    self.nesting = 0;
    return self;
  },

  // Consume the input matching the named regex (see below) and return the
  // match if there was any.
  consume: function(rx_name)
  {
    var m = this.value.match(this[rx_name]);
    if (m) this.value = this.value.substr(m[0].length);
    this.ended = !this.value.length;
    return m;
  },

  // Look but don't consume (to be used for infix)
  lookahead: function(rx_name)
  {
    return this.value.match(this[rx_name]);
  },

  to_number: function(w)
  {
    return this.list_number.test(w) ? parseFloat(w) : NaN;
  },

  is_number: function(w)
  {
    return this.list_number.test(w);
  },

  whitespace:    /^\s+/,
  quoted:        /^"((?:[^\s\[\]\(\);\\]|(?:\\.))*)/,
  number:        /^((\d+(\.\d*)?)|(\d*\.\d+))(?=[\s\[\]\(\)+\-*\/=<>;]|$)/,
  word:          /^(?:[^\s\[\]\(\)+\-*\/=<>;\\]|(?:\\.))+/,
  word_or_thing: /^(:?)((?:[^\s\[\]\(\)+\-*\/=<>;\\]|(?:\\.))+)/,
  infix_1:       /^(<=|>=|<>|=|<|>)/,
  infix_2:       /^(\+|\-)/,
  infix_3:       /^(\*|\/)/,
  list_begin:    /^\[/,
  list_end:      /^\]/,
  list_number:   /^(\d+(\.\d*)?)|(\d*\.\d+)/,
  list_word:     /^([^\s\[\]\\]|(\\.))+/,
  paren_begin:   /^\(/,
  paren_end:     /^\)/,
});

// Eval a token from the stream
function eval_token(stream, k)
{
  var m = stream.consume("whitespace");
  if (stream.ended) return k.tail();
  if (m = stream.consume("list_begin")) {
    return eval_list.tail(stream, [], k);
  } else if (m = stream.consume("list_end")) {
    return k.tail(error("Unexpected |]|"));
  } else if (m = stream.consume("paren_begin")) {
    ++stream.nesting;
    stream.consume("whitespace");
    // TODO get more input with \ here
    if (stream.ended) return k.tail(error("Unexpected end of input"));
    if (m = stream.consume("word")) {
      return eval_word_greedy.tail(m[0], stream, k);
    } else {
      return k.tail(error("Expected procedure in parens"));
    }
  } else if (m = stream.consume("paren_end")) {
    if (stream.nesting === 0) return k.tail(error("Unexpected |)|"));
    --stream.nesting;
    return k.tail({ paren_end: true });
  } else if (m = stream.consume("quoted")) {
    return eval_quoted.tail(m[1], k);
  } else if (m = stream.consume("number")) {
    return eval_number.tail(m[0], k);
  } else if (m = stream.consume("word_or_thing")) {
    if (m[1]) {
      return eval_word.tail("THING", stream, k, m[2]);
    } else {
      return eval_word.tail(m[2], stream, k);
    }
  } else if (m = stream.consume("infix_1")) {
    return eval_infix(m[0], 1, k);
  } else if (m = stream.consume("infix_2")) {
    return eval_infix(m[0], 2, k);
  } else if (m = stream.consume("infix_3")) {
    return eval_infix(m[0], 3, k);
  } else {
    report_error(error("Unexpected input starting from " + stream.value));
  }
}

function eval_list(stream, list, k)
{
  var m = stream.consume("whitespace");
  if (stream.ended) {
    // We're not finished! Get more tokens
    rli.setPrompt("[ ");
    rli.once("line", function(line) {
        eval_list.call_cc(token_stream.$new(line), list, k);
      });
    rli.prompt();
    return;
  } else if (m = stream.consume("list_end")) {
    return k.tail(list);
  } else if (m = stream.consume("list_begin")) {
    return eval_list.tail(stream, [], function(sublist) {
        list.push(sublist);
        return eval_list.tail(stream, list, k);
      });
  } else if (m = stream.consume("list_number")) {
    list.push(parseFloat(m[0]));
    return eval_list.tail(stream, list, k);
  } else if (m = stream.consume("list_word")) {
    list.push(m[0].replace(/\\(.)/g, "$1"));
    return eval_list.tail(stream, list, k);
  }
}

function is_list(token) { return token instanceof Array; }

function is_number(token)
{
  return typeof token === "number" || token_stream.is_number(token);
}

function is_word(token)
{
  return typeof token === "string" || typeof token === "number" ||
    typeof token === "boolean";
}

// Wrapper around eval_next_token to check the current token against a
// predicate p; if there is an error (either bubbling up or because the test
// failed) then report it, otherwise go through the normal continuation
function eval_token_as(stream, p, k)
{
  return eval_token.tail(stream, function(token) {
      if (typeof token === "undefined") {
        return report_error(error("Premature end of input"));
      }
      if (token.is_error) return report_error(token);
      if (p && !p(token)) {
        return report_error(error("Unexpected value " + token));
      }
      return k.tail(token);
    });
}

// Eval a number: simply return its value
function eval_number(n, k) { return k.tail(parseFloat(n)); }

// Eval a quoted word: simply return its value
function eval_quoted(q, k) { return k.tail(q.replace(/\\(.)/g, "$1")); }

// Find function for this word; if there is one, get the default number of
// arguments and execute it
function eval_word(w, stream, k, arg)
{
  var def = WORDS[w.replace(/\\(.)/g, "$1").toUpperCase()];
  if (!def) k.tail(error("I don't know how to " + w));
  var get_args = function(n, args) {
    if (n === 0) {
      return def.run.tail(args, k);
    } else {
      return eval_token.tail(stream, function(token) {
          if (typeof token === "undefined") {
            return report_error(error("Premature end of input"));
          }
          if (token.is_error) return report_error(token);
          args.push(token)
          return get_args.tail(n - 1, args);
        });
    }
  };
  return arg !== undefined ? get_args.tail(def.default - 1, [arg]) :
    get_args.tail(def.default, []);
}

// Eval between min and max arguments
function eval_word_greedy(w, stream, k)
{
  var def = WORDS[w.replace(/\\(.)/g, "$1").toUpperCase()];
  if (!def) k.tail(error("I don't know how to " + w));
  var get_args = function(n, args) {
    return eval_token.tail(stream, function(token) {
        if (typeof token === "object" && token.paren_end) {
          if (n < def.min) return k.tail(error("Not enough arguments"));
          if (n > def.max) return k.tail(error("Too many arguments"));
          return def.run.tail(args, k);
        } else {
          if (token.is_error) return report_error(token);
          args.push(token)
          return get_args.tail(n + 1, args);
        }
      });
  };
  return get_args.tail(0, []);
}

// Eval an infix operator
function eval_infix(op, precedence, k)
{
}

// Implement EQUALP
function equalp(thing1, thing2)
{
  if (is_number(thing1) && is_number(thing2)) {
    return token_stream.to_number(thing1) === token_stream.to_number(thing2);
  } else if (is_word(thing1) && is_word(thing2)) {
    // TODO CASEIGNOREDP
    return thing1.toString().toUpperCase() === thing2.toString().toUpperCase();
  } else if (is_list(thing1) && is_list(thing2) &&
      thing1.length === thing2.length) {
    for (var eq = true, i = 0, n = thing1.length; eq && i < n;
        eq = equalp(thing1[i], thing2[i]), ++i);
    return eq;
  } else {
    return false;
  }
}

// Stringify a token
function stringify(token)
{
  return is_list(token) ? token.map(stringify).join(" ") : token.toString();
}

var WORDS =
{
  WORD: { min: 0, max: Infinity, "default": 2, run: function(args, k) {
      return k.tail(args
          .reduce(function(acc, w) { return acc + w.toString(); }, ""));
    } },

  LIST: { min: 0, max: Infinity, "default": 2, run: function(args, k) {
      return k.tail(args
          .reduce(function(acc, thing) { acc.push(thing); return acc; }, []));
    } },

  SENTENCE: { min: 0, max: Infinity, "default": 2, run: function(args, k) {
      return k.tail(args
          .reduce(function(acc, thing) { return acc.concat(thing); }, []));
    } },

  FPUT: { min: 2, max: 2, "default": 2, run: function(args, k) {
    } },

  QUOTIENT: { min: 1, max: 2, "default": 2, run: function(args, k) {
      var n = args.length === 1 ? 1 : token_stream.to_number(args[0]);
      var m = token_stream.to_number(args[args.length === 1 ? 0 : 1]);
      // check isNaN(n), isNaN(m), m !== 0
      return k.tail(n / m);
    } },

  PRINT: { min: 0, max: Infinity, "default": 1, run: function(args, k) {
      args.forEach(function(x) { console.log(stringify(x)); });
      return k.tail();
    } },

  READWORD: { min: 0, max: 0, "default": 0, run: function(args, k)
    {
      rli.setPrompt("word > ");
      rli.once("line", function(line) { return k.call_cc(line); });
      rli.prompt();
    } },

  THING: { min: 1, max: 1, "default": 1, run: function(args, k) {
      var name = args[0];
      return k.tail(error("{0} has no value".fmt(name)));
    } },
};


// Tokenize and evaluate a string
function eval_string(str, k)
{
  var stream = token_stream.$new(str);
  return (function eval_stream() {
    return stream.ended ? k.tail() : eval_token.tail(stream, function(v) {
        if (typeof v !== "undefined") {
          return report_error.tail(v.message ? v :
            error("I don't know what to do with " + v));
        } else {
          return eval_stream.tail();
        }
      })
  }).tail();
}

var readline = require("readline");
var rli = readline.createInterface(process.stdin, process.stdout);
rli.on("close", function() {
    process.stdout.write("\n");
    process.exit(0);
  });

function report_error(error)
{
  console.log("Error: " + error.message);
  repl();
}

function repl()
{
  rli.setPrompt("? ");
  rli.once("line", function(line) { return eval_string.call_cc(line, repl); });
  rli.prompt();
};
repl();
