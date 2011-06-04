// Originally by Spencer Tipping; see
// http://github.com/spencertipping/js-in-ten-minutes

Function.prototype.tail = function()
{
  return [this, arguments];
};

Function.prototype.tco = function()
{
  var c = [this, arguments];
  var esc = arguments[arguments.length - 1];
  while (c && c[0] !== esc) c = c[0].apply(this, c[1]);
  if (c) {
    return esc.apply(this, c[1]);
  } else {
    process.stderr.write("(done)\n");
  }
};

function id(x) { return x; }
function nop() {}


function error(message)
{
  return { message: message, is_error: true };
}

// Token stream is a wrapper around a string since strings are immutable in JS
var token_stream =
{
  init: function(str)
  {
    this.consumed = "";
    this.value = str;
    this.ended = !str.length;
    return this;
  },

  // Consume the input matching rx and return true if there was a match
  // rx must be anchored!
  // TODO consume a symbol rather than a regex so that we can use an already
  // tokenized input (e.g. a list), and also ensure that all our regexes are
  // anchored
  consume: function(rx)
  {
    var m = this.value.match(rx);
    if (m) {
      var l = m[0].length;
      this.consumed += this.value.substr(0, l);
      this.value = this.value.substr(l);
    }
    this.ended = !this.value.length;
    return m;
  },
};

// Eval a token from the stream
function eval_token(stream, k)
{
  var m = stream.consume(/^\s+/);
  if (stream.ended) return k.tail();
  if (m = stream.consume(/^"((?:[^\s\[\]\(\);\\]|(?:\\.))*)/)) {
    return eval_quoted.tail(m[1], k);
  } else if (m = stream
      .consume(/^((\d+(\.\d*)?)|(\d*\.\d+))(?=[\s\[\]\(\)+\-*\/=<>;]|$)/)) {
    return eval_number.tail(m[0], k);
  } else if (m = stream
      .consume(/^(:?)((?:[^\s\[\]\(\)+\-*\/=<>;\\]|(?:\\.))+)/)) {
    return eval_word.tail(m[0], stream, k);
  } else {
    report_error(error("Unexpected input " + stream.value));
  }
}

function is_any() { return true; }
function is_number(token) { return !isNaN(token); }
function is_word(token) { return true; } // we don't have lists yet!

// Wrapper around eval_token to check the current token against a predicate p;
// if there is an error (either bubbling up or because the test failed) then
// report it, otherwise go through the normal continuation
function eval_token_as(stream, p, k)
{
  return eval_token.tail(stream, function(token) {
      if (token.is_error) return report_error(token);
      if (!p(token)) return report_error(error("Unexpected value " + token));
      return k.tail(token);
    });
}

// Eval a number: simply return its value
function eval_number(n, k) { return k.tail(parseFloat(n)); }

// Eval a quoted word: simply return its value
function eval_quoted(q, k) { return k.tail(q.replace(/\\(.)/g, "$1")); }

// Eval a word: find the corresponding function and execute it, getting the
// arguments from the token stream
function eval_word(w, stream, k)
{
  var f = WORDS[w.replace(/\\(.)/g, "$1").toUpperCase()];
  return f ?
    f.tail(stream, k) :
    k.tail(error("I don't know how to " + w));
}

// Predefined words
WORDS =
{
  // Constructors

  WORD: function(stream, k)
  {
    return eval_token_as.tail(stream, is_word, function(word1) {
        return eval_token_as.tail(stream, is_word, function(word2) {
            return k.tail(word1.toString() + word2.toString());
          });
      });
  },

  // TODO LIST
  // TODO SENTENCE

  // TODO list
  FPUT: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            if (is_word(thing2) && is_word(thing1) && thing1.length === 1) {
              return k.tail(thing1.toString() + thing2.toString());
            } else {
              return k.tail(error("You made FPUT sad"));
            }
          });
      });
  },

  // TODO list
  LPUT: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            if (is_word(thing2) && is_word(thing1) && thing1.length === 1) {
              return k.tail(thing2.toString() + thing1.toString());
            } else {
              return k.tail(error("You made LPUT sad"));
            }
          });
      });
  },

  // TODO COMBINE, REVERSE, GENSYM (library)


  // Selectors

  // TODO list
  FIRST: function(stream, k)
  {
    return eval_token_as.tail(stream, is_word, function(thing) {
        if (thing.length === 0) return k.tail(error("Empty input for FIRST"));
        return k.tail(thing[0]);
      });
  },

  // TODO FIRSTS

  // TODO list
  LAST: function(stream, k)
  {
    return eval_token_as.tail(stream, is_word, function(thing) {
        if (thing.length === 0) return k.tail(error("Empty input for LAST"));
        return k.tail(thing[thing.length - 1]);
      });
  },

  // TODO list, BF
  BUTFIRST: function(stream, k)
  {
    return eval_token_as.tail(stream, is_word, function(thing) {
        if (thing.length === 0) return k.tail(error("Empty input for BUTFIRST"));
        return k.tail(thing.substr(1));
      });
  },

  // TODO BUTFIRSTS

  // TODO list, BL
  BUTLAST: function(stream, k)
  {
    return eval_token_as.tail(stream, is_word, function(thing) {
        if (thing.length === 0) return k.tail(error("Empty input for BUTLAST"));
        return k.tail(thing.substr(0, thing.length - 1));
      });
  },






  COUNT: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing) {
        return k.tail(thing.length);
      });
  },

  MINUS: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return k.tail(-n);
      });
  },

  PRINT: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing) {
        console.log(thing);
        return k.tail();
      });
  },

  READWORD: function(stream, k)
  {
    rli.setPrompt("word > ");
    rli.once("line", function(line) { k.tco(line); });
    rli.prompt();
    // stop evaluation until input is received: don't return any continuation
  },

  SUM: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return eval_token_as.tail(stream, is_number, function(m) {
            return k.tail(n + m);
          });
      });
  },
};

// Tokenize and evaluate a string
function eval_string(str, k)
{
  var stream = Object.create(token_stream).init(str);
  return (function eval_stream() {
    return stream.ended ? k.tail() : eval_token.tail(stream, eval_stream);
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
  rli.once("line", function(line) { return eval_string.tco(line, repl); });
  rli.prompt();
};
repl();
