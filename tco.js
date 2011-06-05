// TODO:
//   * premature end of input
//   * parens/slurp
//   * infix
//   * function declaration
//   * vbarred

require("populus");

function error(message)
{
  return { message: message, is_error: true };
}

// Token stream is a wrapper around a string since strings are immutable in JS
var token_stream =
{
  init: function(str)
  {
    this.value = str;
    this.ended = !str.length;
    return this;
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
    if (this.list_number.test(w)) {
      var n = parseFloat(w);
      if (!isNaN(n)) return n;
    }
    return w;
  },

  is_number: function(w)
  {
    return this.list_number.test(w);
  },

  whitespace:    /^\s+/,
  quoted:        /^"((?:[^\s\[\]\(\);\\]|(?:\\.))*)/,
  number:        /^((\d+(\.\d*)?)|(\d*\.\d+))(?=[\s\[\]\(\)+\-*\/=<>;]|$)/,
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
};

// Eval a token from the stream
function eval_token(stream, k)
{
  var m = stream.consume("whitespace");
  if (stream.ended) return k.tail();
  if (m = stream.consume("list_begin")) {
    return eval_list.tail(stream, [], k);
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
  if (m = stream.consume("list_end")) {
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

function is_any() { return true; }
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

// Eval a word: find the corresponding function and execute it, getting the
// arguments from the token stream
function eval_word(w, stream, k, arg)
{
  var f = WORDS[w.replace(/\\(.)/g, "$1").toUpperCase()];
  return f ?
    f.tail(stream, k, arg) :
    k.tail(error("I don't know how to " + w));
}

// Eval an infix operator
function eval_infix(op, precedemce, k)
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

// Predefined words
WORDS =
{
  // Constructors

  // TODO ()
  WORD: function(stream, k)
  {
    return eval_token_as.tail(stream, is_word, function(word1) {
        return eval_token_as.tail(stream, is_word, function(word2) {
            return k.tail(word1.toString() + word2.toString());
          });
      });
  },

  // TODO ()
  LIST: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            return k.tail([thing1, thing2]);
          });
      });
  },

  // TODO SE, ()
  SENTENCE: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            return k.tail((is_list(thing1) ? thing1 : [thing1]).concat(thing2));
          });
      });
  },

  FPUT: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            if (is_list(thing2)) {
              thing2.unshift(thing1);
              return k.tail(thing2);
            } else if (is_word(thing2) &&
                is_word(thing1) && thing1.length === 1) {
              return k.tail(thing1.toString() + thing2.toString());
            } else {
              return k.tail(error("You made FPUT sad"));
            }
          });
      });
  },

  LPUT: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            if (is_list(thing2)) {
              thing2.push(thing1);
              return k.tail(thing2);
            } else if (is_word(thing2) &&
                is_word(thing1) && thing1.length === 1) {
              return k.tail(thing2.toString() + thing1.toString());
            } else {
              return k.tail(error("You made LPUT sad"));
            }
          });
      });
  },

  // TODO COMBINE, REVERSE, GENSYM (library)


  // Selectors

  FIRST: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing) {
        if (thing.length === 0) return k.tail(error("Empty input for FIRST"));
        return k.tail(thing[0]);
      });
  },

  FIRSTS: function(stream, k)
  {
    return eval_token_as.tail(stream, is_list, function(list) {
        return k.tail(list.map(function(x) { return x[0]; }));
      });
  },

  LAST: function(stream, k)
  {
    return eval_token_as.tail(stream, is_word, function(thing) {
        if (thing.length === 0) return k.tail(error("Empty input for LAST"));
        return k.tail(thing[thing.length - 1]);
      });
  },

  // TODO BF
  BUTFIRST: function(stream, k)
  {
    return eval_token_as.tail(stream, is_word, function(thing) {
        if (thing.length === 0) {
          return k.tail(error("Empty input for BUTFIRST"));
        }
        return k.tail(thing.slice(1));
      });
  },

  FIRSTS: function(stream, k)
  {
    return eval_token_as.tail(stream, is_list, function(list) {
        return k.tail(list.map(function(x) { return x.slice(1); }));
      });
  },


  // TODO BL
  BUTLAST: function(stream, k)
  {
    return eval_token_as.tail(stream, is_word, function(thing) {
        if (thing.length === 0) {
          return k.tail(error("Empty input for BUTLAST"));
        }
        return k.tail(thing.slice(0, thing.length - 1));
      });
  },

  ITEM: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(index) {
        return eval_token_as.tail(stream, is_any, function(thing) {
            var item = thing[stream.to_number(index) - 1];
            if (item === undefined) {
              return k.tail(error("No item at index " + index));
            }
            return k.tail(item);
          });
      });
  },

  // TODO PICK, REMOVE, REMDUP, QUOTED (library)
  // Mutators? PUSH, POP, QUEUE, DEQUEUE (library)

  // Predicats

  // TODO WORD?
  WORDP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing) {
        return k.tail(is_word(thing));
      });
  },

  // TODO LIST?
  LISTP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing) {
        return k.tail(is_list(thing));
      });
  },

  // TODO EMPTY?
  EMPTYP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing) {
        return k.tail(thing.length === 0);
      });
  },

  // TODO EQUAL?, =
  EQUALP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            return k.tail(equalp(thing1, thing2));
          });
      });
  },

  // TODO NOTEQUAL?, <>
  NOTEQUALP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            return k.tail(!equalp(thing1, thing2));
          });
      });
  },

  // TODO BEFORE?
  BEFOREP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_word, function(word1) {
        return eval_token_as.tail(stream, is_word, function(word2) {
            return k.tail(word1.toString() < word2.toString());
          });
      });
  },

  ".EQ": function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            return typeof thing1 === "object" && typeof thing2 === "object" &&
              thing1 === thing2;
          });
      });
  },

  // TODO MEMBER?
  MEMBERP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            if (is_list(thing2)) {
              for (var found = false, i = 0, n = thing2.length; !found && i < n;
                equalp(thing1, thing2[i]), ++i);
              return k.tail(found);
            } else if (is_word(thing1) && thing1.toString().length === 1) {
              return k.tail(thing2.toString().indexOf(thing1.toString()) >= 0);
            } else {
              return k.tail(false);
            }
          });
      });
  },

  // TODO SUBSTRING?
  SUBSTRINGP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing1) {
        return eval_token_as.tail(stream, is_any, function(thing2) {
            return k.tail(is_word(thing1) && is_word(thing2) &&
              thing2.toString().indexOf(thing1.toString()) >= 0);
          });
      });
  },

  // TODO NUMBER?
  NUMBERP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing) {
        return k.tail(is_number(thing));
      });
  },

  // TODO VBARREDP, BACKSLASHEDP

  // Queries

  COUNT: function(stream, k)
  {
    return eval_token_as.tail(stream, is_any, function(thing) {
        return k.tail(thing.length);
      });
  },


  // Numeric operations

  // TODO (), +
  SUM: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return eval_token_as.tail(stream, is_number, function(m) {
            return k.tail(stream.to_number(n) + stream.to_number(m));
          });
      });
  },

  // TODO -
  DIFFERENCE: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return eval_token_as.tail(stream, is_number, function(m) {
            return k.tail(stream.to_number(n) - stream.to_number(m));
          });
      });
  },

  // TODO -
  MINUS: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return k.tail(-stream.to_number(n));
      });
  },

  // TODO (), *
  PRODUCT: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return eval_token_as.tail(stream, is_number, function(m) {
            return k.tail(stream.to_number(n) * stream.to_number(m));
          });
      });
  },

  // TODO (), /
  QUOTIENT: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return eval_token_as.tail(stream, is_number, function(m) {
            return k.tail(stream.to_number(n) / stream.to_number(m));
          });
      });
  },

  // Predicates

  // TODO LESS?, <
  LESSP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return eval_token_as.tail(stream, is_number, function(m) {
            return k.tail(stream.to_number(n) < stream.to_number(m));
          });
      });
  },

  // TODO GREATER?, >
  GREATERP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return eval_token_as.tail(stream, is_number, function(m) {
            return k.tail(stream.to_number(n) > stream.to_number(m));
          });
      });
  },

  // TODO LESSEQUAL?, <=
  LESSEQUALP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return eval_token_as.tail(stream, is_number, function(m) {
            return k.tail(stream.to_number(n) <= stream.to_number(m));
          });
      });
  },

  // TODO GREATEREQUAL?, >=
  GREATEREQUALP: function(stream, k)
  {
    return eval_token_as.tail(stream, is_number, function(n) {
        return eval_token_as.tail(stream, is_number, function(m) {
            return k.tail(stream.to_number(n) >= stream.to_number(m));
          });
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
    rli.once("line", function(line) { k.call_cc(line); });
    rli.prompt();
    // stop evaluation until input is received: don't return any continuation
  },


  THING: function(stream, k, name)
  {
    if (typeof name !== "undefined") {
      return k.tail(error(name + " has no value"));
    } else {
      return eval_token_as.tail(stream, is_word, function(name) {
          return k.tail(error(name + " has no value"));
        });
    }
  },
};

// Tokenize and evaluate a string
function eval_string(str, k)
{
  var stream = Object.create(token_stream).init(str);
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
