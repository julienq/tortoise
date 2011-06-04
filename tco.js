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
  while (c[0] !== esc) c = c[0].apply(this, c[1]);
  return esc.apply(this, c[1]);
};

function id(x) { return x; }
function nop() {}


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
  }
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
  return f.tail(stream, k);
}

// Predefined words
WORDS =
{
  COUNT: function(stream, k)
  {
    return eval_token.tail(stream, function(thing) {
        return k.tail(thing.length);
      });
  },

  MINUS: function(stream, k)
  {
    return eval_token.tail(stream, function(n) {
        return k.tail(-n);
      });
  },

  PRINT: function(stream, k)
  {
    return eval_token.tail(stream, function(thing) {
        console.log(thing);
        return k.tail();
      });
  },

  SUM: function(stream, k)
  {
    return eval_token.tail(stream, function(n) {
        return eval_token.tail(stream, function(m) {
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

(function repl()
{
  rli.setPrompt("? ");
  rli.once("line", function(line) { return eval_string.tco(line, repl); });
  rli.prompt();
})();
