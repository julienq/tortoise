// TODO:
//   * fix tokenizer once and for all
//   * infix
//   * function declaration
//   * vbarred
//   * multiline
//   * errors

var populus = require("populus");

var readline = require("readline");
var rli = readline.createInterface(process.stdin, process.stdout);
rli.on("close", function() {
    process.stdout.write("\n");
    process.exit(0);
  });

function prompt(p, f)
{
  rli.setPrompt(p);
  rli.once("line", function(line) { f.call_cc(line); });
  rli.prompt();
}

var tokenizer =
{
  $new: function()
  {
    var self = Object.create(tokenizer);
    self.input = "";
    self.paren_nesting = 0;
    self.list_nesting = 0;
    return self;
  },

  // Consume the input matching the named regex (see below) and return the
  // match if there was any.
  consume: function(rx)
  {
    var m = this.input.match(rx);
    if (m) this.input = this.input.substr(m[0].length);
    return m;
  },

  // Eat whitespace and comments to be ready to consume an actual token
  // If we reach the end of input and require more (because the line ended with
  // \ or ~ or there are unclosed parens) prompt for more input.
  function advance(more, k)
  {
    var m = this.consume(this.WHITESPACE);
    if (this.end_of_input) {
      /*if (m[2] === "~") {
        if (m[1].length === 0 && want_more) {
          return prompt(stream, "~ ",
              function(stream) { k.call_cc(""); });
        } else {
          return
        }
      }*/
      /*if (m[2] === "\\") {
        // Todo add literal \ to input
        return prompt(stream, "\\ ", function(stream) { k.call_cc(false); });
      }*/
      if (stream.paren_nesting > 0) {
        return prompt(stream, "( ", function(stream) { k.call_cc(); });
      }
      if (stream.list_nesting > 0) {
        return prompt(stream, "[ ", function(stream) { k.call_cc(); });
      }
    }
    return k.tail();
  }

  next: function(k)
  {
    this.advance(function() {
        if (this.end_of_input) return k.tail();
        if (this.quoted) {
          var q = m[1];
          return k.tail(function() { return q; });
        }
        if (this.number) {
          var n = parseFloat(m[1]);
          return k.tail(function() { return n; });
        }
        if (this.word) {
          var w = WORDS[m[0].toUpperCase()];
          if (w) {
            return k.tail(function() { return apply(w); });
          } else {
            // error!
          }
        }
        // error!
      });
  },

  // Apply a function, getting values directly from the tokenizer
  function apply(w)
  {
    w.run();
  },

  WHITESPACE:    /^(\s*)(?:;(?:[^\\~]|[\\~].)*)?(?:([\\~]?)$)?/,
  QUOTED:        /^"((?:[^\s\[\]\(\);\\\~]|(?:\\.))*)/,
  NUMBER:        /^((\d+(\.\d*)?)|(\d*\.\d+))(?=[\s\[\]\(\)+\-*\/=<>;\\\~]|$)/,
  WORD:          /^(?:[^\s\[\]\(\)+\-*\/=<>;\\\~]|(?:\\.))+/,
  THING:         /^:?((?:[^\s\[\]\(\)+\-*\/=<>;\\\~]|(?:\\.))+)/,
  INFIX_1:       /^(<=|>=|<>|=|<|>)/,
  INFIX_2:       /^(\+|\-)/,
  INFIX_3:       /^(\*|\/)/,
  LIST_BEGIN:    /^\[/,
  LIST_END:      /^\]/,
  LIST_NUMBER:   /^(\d+(\.\d*)?)|(\d*\.\d+)/,
  LIST_WORD:     /^([^\s\[\]\\]|(\\.))+/,
  PAREN_BEGIN:   /^\(/,
  PAREN_END:     /^\)/,
};

Object.defineProperty(tokenizer, "end_of_input", { enumerable: true,
  get: function() { return this.input.length === 0; });

var tokenizer = tokenizer.$new();
prompt("? ", function(input) {
    tokenizer.input += input;
    return tokenizer.next.tail(function(f) { console.log(f()); });
  });

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




/*









function error(message)
{
  return { message: message, is_error: true };
}

// Token stream is a wrapper around a string since strings are immutable in JS
// Keep track of levels of nesting so that it know if more input is required
var token_stream = populus.object.create({

  init: function(str)
  {
    var self = this.call_super("init");
    self.value = str;
    self.paren_nesting = 0;
    self.list_nesting = 0;
    return self;
  },

  // True when the end of the stream has been reached
  ended: { get: function() { return !this.value.length; } },

  // Consume the input matching the named regex (see below) and return the
  // match if there was any.
  consume: function(rx_name)
  {
    var m = this.value.match(this[rx_name]);
    if (m) this.value = this.value.substr(m[0].length);
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

  whitespace:    /^(\s*)(?:;(?:[^\\~]|[\\~].)*)?(?:([\\~]?)$)?/,
  quoted:        /^"((?:[^\s\[\]\(\);\\\~]|(?:\\.))*)/,
  number:        /^((\d+(\.\d*)?)|(\d*\.\d+))(?=[\s\[\]\(\)+\-*\/=<>;\\\~]|$)/,
  word:          /^(?:[^\s\[\]\(\)+\-*\/=<>;\\\~]|(?:\\.))+/,
  word_or_thing: /^(:?)((?:[^\s\[\]\(\)+\-*\/=<>;\\\~]|(?:\\.))+)/,
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

// Eat whitespace and comments to be ready to consume an actual token
// If we reach the end of input and require more (because the line ended with
// \ or ~ or there are unclosed parens) prompt for more input.
function advance_stream(stream, want_more, k)
{
  var m = stream.consume("whitespace");
  if (stream.ended) {
    if (m[2] === "~") {
      if (m[1].length === 0 && want_more) {
        return prompt(stream, "~ ",
            function(stream) { k.call_cc(""); });
      } else {
        return 
      }
    }
    if (m[2] === "\\") {
      // Todo add literal \ to input
      return prompt(stream, "\\ ", function(stream) { k.call_cc(false); });
    }
    if (stream.paren_nesting > 0) {
      return prompt(stream, "( ", function(stream) { k.call_cc(false); });
    }
    if (stream.list_nesting > 0) {
      return prompt(stream, "[ ", function(stream) { k.call_cc(false); });
    }
  }
  return k.tail();
}

function tokenize(stream, k)
{
  return advance_stream.tail(stream, "", function() {
      if (stream.ended) return k.tail();
      var m;
      if (m = stream.consume("paren_begin")) {
        ++stream.paren_nesting
        return k.tail("( {0}".fmt(stream.paren_nesting));
      }
      if (m = stream.consume("paren_end")) {
        --stream.paren_nesting
        return k.tail(") {0}".fmt(stream.paren_nesting));
      }
      if (m = stream.consume("number")) {
        return advance_stream.tail(stream, m[0], function() {
            if (unfinished) {
              stream.value = m[0] + stream.value;
              return k.tail();
            } else {
              return k.tail(parseFloat(m[0]));
            }
          });
      }
      if (m = stream.consume("quoted")) {
        return advance_stream.tail(stream, function(unfinished) {
            if (unfinished) {
              stream.value = m[0] + stream.value;
              return k.tail();
            } else {
              return k.tail(m[1]);
            }
          });
      }
      if (m = stream.consume("word")) {
        return advance_stream.tail(stream, function(unfinished) {
            if (unfinished) {
              stream.value = m[0] + stream.value;
              return k.tail();
            } else {
              return k.tail(m[0].toUpperCase());
            }
          });
      }
      return k.tail(error('Unexpected input starting from "{0}"'
            .fmt(stream.value)));
    });
}
*/
/*

// Eval a token from the stream
function eval_token(stream, k)
{
  var m = stream.consume("whitespace");
  if (stream.ended) {
    if (stream.nesting > 0) {
      rli.setPrompt("( ");
      rli.once("line", function(line) {
          stream.value += line;
          eval_token.call_cc(stream, k);
        });
      rli.prompt();
      return;
    } else {
      return k.tail();
    }
  }
  if (m = stream.consume("list_begin")) return eval_list.tail(stream, [], k);
  if (m = stream.consume("list_end")) return k.tail(error("Unexpected |]|"));
  if (m = stream.consume("paren_begin")) {
    ++stream.nesting;
    stream.consume("whitespace");
    var greedy = function()
    {
      if (m = stream.consume("word")) {
        return eval_word_greedy.tail(m[0], stream, k);
      } else {
        return k.tail(error("Expected procedure in parens"));
      }
    };
    if (stream.ended) {
      rli.setPrompt("( ");
      rli.once("line", function(line) {
          stream.value += line;
          greedy.call_cc();
        });
      rli.prompt();
      return;
    } else {
      return greedy.tail(stream);
    }
  }
  if (m = stream.consume("list_end")) return k.tail(error("Unexpected |]|"));
  if (m = stream.consume("paren_end")) {
    if (stream.nesting === 0) return k.tail(error("Unexpected |)|"));
    --stream.nesting;
    return k.tail({ paren_end: true });
  }
  if (m = stream.consume("quoted")) return eval_quoted.tail(m[1], k);
  if (m = stream.consume("number")) return eval_number.tail(m[0], k);
  if (m = stream.consume("word_or_thing")) {
    if (m[1]) {
      return eval_word.tail("THING", stream, k, m[2]);
    } else {
      return eval_word.tail(m[2], stream, k);
    }
  }
  if (m = stream.consume("infix_1")) return eval_infix(m[0], 1, k);
  if (m = stream.consume("infix_2")) return eval_infix(m[0], 2, k);
  if (m = stream.consume("infix_3")) return eval_infix(m[0], 3, k);
  return k.tail(error("Unexpected input starting from " + stream.value));
}

function eval_list(stream, list, k)
{
  var m = stream.consume("whitespace");
  if (stream.ended) {
    // We're not finished! Get more tokens
    rli.setPrompt("[ ");
    rli.once("line", function(line) {
        stream.value += line;
        eval_list.call_cc(stream, list, k);
      });
    rli.prompt();
    return;
  }
  if (m = stream.consume("list_end")) return k.tail(list);
  if (m = stream.consume("list_begin")) {
    return eval_list.tail(stream, [], function(sublist) {
        list.push(sublist);
        return eval_list.tail(stream, list, k);
      });
  }
  if (m = stream.consume("list_number")) {
    list.push(parseFloat(m[0]));
    return eval_list.tail(stream, list, k);
  }
  if (m = stream.consume("list_word")) {
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
  return arg !== undefined ? get_args.tail(def["default"] - 1, [arg]) :
    get_args.tail(def["default"], []);
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

// Evaluate a line of input
function eval_input(line, k)
{
  var stream = token_stream.$new(line);
  return (function eval_stream() {
    if (stream.ended) return k.tail();
    return eval_word.tail(stream, function(error) {
        if (error) {
          console.log("Error: {0}".fmt(error.message));
          return k.tail();
        }
        return eval_stream.tail();
      });
  }).tail();
}

function report_error(error)
{
  console.log("Error: " + error.message);
  repl();
}

function repl()
{
  rli.setPrompt("? ");
  rli.once("line", function(line) { return eval_input.call_cc(line, repl); });
  rli.prompt();
};
repl();
*/

(function tokenize_input(stream) {
  prompt(stream, "? ", function(stream) {
      var show_token = function(token)
      {
        if (typeof token === "undefined") {
          return stream.ended ? tokenize_input.tail(stream) :
            tokenize.tail(stream, show_token);
        }
        if (token.is_error) {
          console.log("Error: {0}".fmt(token.message));
          stream.value = "";
          return tokenize_input.tail(stream);
        }
        console.log(token)
        return tokenize.tail(stream, show_token);
      };
      return tokenize.tail(stream, show_token);
    });
})(token_stream.$new(""));
