/* Copyright © 2011, Julien Quint <julien@igel.co.jp>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *   • Redistributions of source code must retain the above copyright notice,
 *     this list of conditions and the following disclaimer.
 *   • Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *   • Neither the name of romulusetrem.us nor the names of its contributors
 *     may be used to endorse or promote products derived from this software
 *     without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE. */


// Functions in the logo namespace, or exported to a logo module if used with
// node.js
(function(logo) {

  // Global scope
  logo.scope_global = logo.scope = { things: {} };

  // Global Mersenne Twister used by RANDOM/RERANDOM
  if (typeof exports !== null) var populus = require("./spqr/populus");
  MERSENNE_TWISTER = populus.mersenne_twister();


  // An undefined word (and the base for the hierarchy of tokens
  logo.$undefined =
  {
    butfirst: function() { return this; },
    butlast: function() { return this; },
    equalp: function(t) { return false; },
    run: function(f) {
        f(logo.error(logo.ERR_DOESNT_LIKE, this.show())); },
    fput: function() { return this; },
    is_procedure: function() { return false; },
    item: function(i) { return this; },
    lput: function() { return this; },
    show: function(surface) { return "undefined"; },
    show_internals: function() { return "$undefined={}"; },
    toString: function() { return "*undefined*"; }
  };

  // Simply return the value of the word, unless we're at the top execution
  // level in which case we don't know what to do with this value
  logo.$undefined.apply = function(tokens, f)
  {
    if (logo.scope.current_token) {
      f(undefined, this);
    } else {
      f(logo.error(logo.ERR_WHAT_TO_DO, $show(this)));
    }
  };


  // A Logo word
  logo.$word = Object.create(logo.$undefined, {
      butfirst: { enumerable: true, configurable: true,
          value: function() { return logo.word(this.toString().substr(1)); } },
      butlast: { enumerable: true, configurable: true,
          value: function() { return logo.word(this.toString()
              .substr(0, this.toString().length - 1));
            } },
      contains: { enumerable: true, configurable: true,
          value: function(thing) { return thing.is_word && thing.count === 1
            && this.toString().indexOf(thing) >= 0;  } },
      count: { enumerable: true, configurable: true,
          get: function() { return this.toString().length; } },
      equalp: { enumerable: true, configurable: true,
          value: function(t) { return this.is_word &&
            this.value === t.value; } },
      is_defined: { enumerable: true, configurable: true, value: true },
      is_word: { enumerable: true, configurable: true, value: true },
      item: { enumerable: true, configurable: true,
        value: function(i) {
            return logo.word(this.toString().substr(i - 1, 1)); } },
      show: { enumerable: true, configurable: true,
        value: function(surface) {
            return surface && this.surface || this.toString(); } },
      show_internals: { enumerable: true, configurable: true,
        value: function() {
            return "$word={{{0}},{{1}}}".fmt(this.value, this.surface); } },
      toString: { enumerable: true, configurable: true,
        value: function() { return this.value.toString(); } },
    });

  // Handle FPUT for words
  logo.$word.fput = function(thing)
  {
    if (thing.is_word && thing.toString().length === 1) {
      return logo.word(thing.toString() + this.toString());
    } else {
      throw logo.error(logo.ERR_DOESNT_LIKE, $show(thing));
    }
  };

  // Handle LPUT for words
  logo.$word.lput = function(thing)
  {
    if (thing.is_word && thing.value.length === 1) {
      return logo.word(this.toString() + thing.toString());
    } else {
      throw logo.error(logo.ERR_DOESNT_LIKE, $show(thing));
    }
  };


  // A number (a float), can be specialized as an integer
  logo.$number = Object.create(logo.$word, {
      equalp: { enumerable: true, value: function(t) {
          return t.is_number && this.value === t.value;
        } },
      is_number: { enumerable: true, value: true },
      show_internals: { enumerable: true, configurable: true,
        value: function() {
          return "$number={{{0}},{{1}}}".fmt(this.value, this.surface);
        } },
    });

  // An integer (although of course its value is still a float...)
  logo.$integer = Object.create(logo.$number, {
      equalp: { enumerable: true, value: function(t) {
          return t.is_integer && this.value === t.value;
        } },
      is_integer: { enumerable: true, value: true },
      show_internals: { enumerable: true, configurable: true,
        value: function() {
          return "$integer={{{0}},{{1}}}".fmt(this.value, this.surface); } },
    });

  // A boolean (TRUE or FALSE)
  logo.$boolean = Object.create(logo.$word, {
      is_false: { enumerable: true, get: function() { return !this.value; } },
      is_true: { enumerable: true, get: function() { return this.value; } },
      show_internals: { enumerable: true, configurable: true,
        value: function() {
          return "$boolean:{{{0}},{{1}}}".fmt(this.value, this.surface); } },
    });


  // A procedure invocation token
  logo.$procedure = Object.create(logo.$word, {
      is_procedure: { enumerable: true, configurable: true,
          value: function(p) { return this.value === p; } },
    });

  // Apply this procedure: consume the necessary tokens for evaluating the
  // arguments and call the continuation function with an error or a value on
  // success.
  logo.$procedure.apply = function(tokens, f)
  {
    var p = logo.procedures[this.value];
    if (typeof p === "function") {
      var parent = logo.scope;
      logo.scope = Object.create(logo.scope);
      logo.scope.parent = parent;
      logo.scope.current_token = this;
      logo.scope.in_parens = !!this.in_parens;
      p(tokens, function(error, value) {
          logo.scope = logo.scope.parent;
          delete logo.scope.current_token;
          f(error, value);
        });
    } else {
      f(logo.error(logo.ERR_HOW_TO, this.show()));
    }
  };


  // The list token has an array of tokens for values
  logo.$list = Object.create(logo.$word, {
      contains: { enumerable: true, configurable: true,
          value: function(thing) {
              for (var i = 0, n = this.value.length; i < n; ++i) {
                if (this.value[i].equalp(thing)) return true;
              }
              return false;
            } },
      count: { enumerable: true, configurable: true,
          get: function() { return this.value.length; } },
      is_list: { enumerable: true, configurable: true, value: true },
      is_word: { enumerable: true, value: false },
      item: { enumerable: true,
          value: function(i) { return this.value[i - 1]; }
        },
      show_internals: { enumerable: true, configurable: true,
        value: function() { return "$list:{{0}}".fmt(this.show()); } },
    });

  // Evaluate the list as a list of tokens
  logo.$list.run = function(f)
  {
    try {
      var tokens = logo.tokenize(this.toString());
      (function loop(val) {
        if (tokens.length === 0) {
          f(undefined, val);
        } else {
          logo.eval_token(tokens, loop, f);
        }
      })();
    } catch(e) {
      f(e);
    }
  };

  logo.$list.butfirst = function()
  {
    var list = logo.list();
    list.value = this.value.slice(1);
    return list;
  };

  logo.$list.butlast = function()
  {
    var list = logo.list();
    list.value = this.value.slice(0, this.value.length - 1);
    return list;
  };

  logo.$list.equalp = function(token)
  {
    return (function deep_eq(x, y)
    {
      if (x.is_list && y.is_list && x.value.length === y.value.length) {
        for (var eq = true, i = 0, n = x.value.length; eq && i < n; ++i) {
          eq = deep_eq(x.value[i], y.value[i]);
        }
        return eq;
      } else {
        return x.is_word && x.equalp(y);
      }
    })(this, token);
  };

  logo.$list.fput = function(t)
  {
    var list = logo.list();
    list.value = this.value.slice(0);
    list.value.unshift(t);
    return list;
  };

  logo.$list.lput = function(t)
  {
    var list = logo.list();
    list.value = this.value.slice(0);
    list.value.shift(t);
    return list;
  };

  // Show the values of the list with the enclosing brackets
  logo.$list.show = function()
  {
    return "[" + this.value.map(function(x) { return x.show(); }).join(" ") +
      "]";
  }

  // Show the values of the list, space-separated, without the enclosing
  // brackets
  logo.$list.toString = function()
  {
    return this.value.map(function(x) {
        var s = x.toString();
        return x.is_list ? "[" + s + "]" : s;
      }).join(" ");
  };


  // A group is a meta token that contains a parenthesized group
  logo.$group = Object.create(logo.$list, {
      is_list: { enumerable: true, value: false }
    });

  logo.$group.apply = function(tokens, f)
  {
    var tokens_ = this.value.slice(0);
    if (tokens_.length > 0) {
      logo.eval(tokens_, function(error, value) {
          if (error || tokens_.length === 0) {
            f(error, value);
          } else {
            f(logo.error(logo.ERR_TOO_MUCH_PARENS));
          }
        });
    } else {
      f(error);
    }
  };

  logo.$group.show = function()
  {
    return "(" + this.value.map(function(x) { return x.show(); }).join(" ") +
      ")";
  };


  // Make an error object from the given error code and additional arguments.
  // The first argument is implied to be the current procedure (if any.) An
  // error object has a code and a message field.
  logo.error = function(code)
  {
    var msg = logo.error_messages[code] || "Unknown error ({0})".fmt(code);
    var args = Array.prototype.slice.call(arguments, 1);
    // Add the current word to the list of argument
    args.unshift($show(logo.scope.current_token));
    return { error_code: code, message: String.prototype.fmt.apply(msg, args) };
  };

  // Error messages; first argument is always the name of current work being
  // evaluted, other arguments are passed to the logo.error constructor
  logo.ERR_INTERNAL = 0;
  logo.ERR_STACK_OVERFLOW = 2;
  logo.ERR_DOESNT_LIKE = 4;
  logo.ERR_NOT_ENOUGH_INPUT = 6;
  logo.ERR_TOO_MUCH_PARENS = 8;
  logo.ERR_WHAT_TO_DO = 9;
  logo.ERR_NO_VAR = 11;
  logo.ERR_UNEXPECTED_PAREN = 12;
  logo.ERR_HOW_TO = 13;
  logo.ERR_ALREADY_DEFINED = 15;
  logo.ERR_ASSUMING_IFELSE = 19;
  logo.ERR_IS_A_PRIMITIVE = 22;
  logo.ERR_CANT_USE_HERE = 23;
  logo.ERR_HOW_TO_FATAL = 24;
  logo.ERR_NO_TEST = 25;
  logo.ERR_UNEXPECTED_BRACKET = 26;

  logo.error_messages = [];
  logo.error_messages[logo.ERR_INTERNAL] = "Fatal internal error ({1})";
  logo.error_messages[logo.ERR_STACK_OVERFLOW] = "Stack overflow";
  logo.error_messages[logo.ERR_DOESNT_LIKE] = "{0} doesn't like {1} as input";
  logo.error_messages[logo.ERR_NOT_ENOUGH_INPUT] = "Not enough inputs to {0}";
  logo.error_messages[logo.ERR_TOO_MUCH_PARENS] = "Too much inside ()'s";
  logo.error_messages[logo.ERR_NO_VAR] = "{1} has no value";
  logo.error_messages[logo.ERR_UNEXPECTED_PAREN] = "Unexpected \")\"";
  logo.error_messages[logo.ERR_WHAT_TO_DO] =
    "You don't say what to do with {1}";
  logo.error_messages[logo.ERR_ASSUMING_IFELSE] =
    "Assuming you mean IFELSE, not IF";
  logo.error_messages[logo.ERR_IS_A_PRIMITIVE] = "{1} is a primitive";
  logo.error_messages[logo.ERR_CANT_USE_HERE] = "Can't use {0} here";
  logo.error_messages[logo.ERR_HOW_TO] =
  logo.error_messages[logo.ERR_HOW_TO_FATAL] = "I don't know how to {1}";
  logo.error_messages[logo.ERR_ALREADY_DEFINED] = "{1} is already defined";
  logo.error_messages[logo.ERR_NO_TEST] = "{0} without TEST";
  logo.error_messages[logo.ERR_UNEXPECTED_BRACKET] = "Unexpected \"]\"";


  // Eval the first token of a list of tokens. The token will then consume the
  // rest of list as necessary. The continuation function f(error, value,
  // tokens) is called on both success (with no error and the value of
  // evaluating the token) and error (when there is no token to evaluate.)
  logo.eval = function(tokens, f)
  {
    if (tokens.length > 0) {
      tokens.shift().apply(tokens, f);
    } else {
      f(logo.error(logo.ERR_NOT_ENOUGH_INPUT));
    }
  };

  // Eval loop: eval while there are tokens available; then call the
  // continuation function with the last value that was evaluated (or the first
  // error that occurs.) All tokens are consumed as opposed to eval which
  // consumes only as many tokens as necessary.
  logo.eval_loop = function(tokens, f, value)
  {
    if (tokens.length > 0) {
      logo.eval(tokens, function(error, value) {
          if (error) {
            f(error);
          } else {
            logo.eval_loop(tokens, f, value);
          }
        });
    } else {
      f(undefined, value);
    }
  };

  // Evaluate one line of input, and call the continuation with the value true
  // to stay in eval mode, or false to switch to definition mode (when the line
  // starts with TO and correctly start a procedure definition.)
  logo.eval_input = function(input, f)
  {
    logo.scope = logo.scope_global;
    logo.scope.exit = f;
    try {
      var tokens = logo.tokenize(input);
      if (tokens.length > 0 && (tokens[0].is_procedure("TO") ||
          tokens[0].is_procedure(".MACRO"))) {
        if (logo.current_def) {
          f(logo.error(ERR_INTERNAL, "Shouldn't be in eval mode here?!"));
        } else {
          var is_macro = tokens[0].is_procedure(".MACRO");
          var args = [];
          var to = tokens.shift();
          logo.scope.current_token = to;
          if (tokens.length > 0) {
            // Read the name of the procedure
            var name = tokens.shift();
            if (!name.is_word) {
              f(logo.error(logo.ERR_DOESNT_LIKE, $show(name)));
            } else if (name in logo.procedures) {
              f(logo.error(logo.ERR_ALREADY_DEFINED, $show(name)));
            } else {
              // Read args: they are pairs of THING followed by a word
              (function read_var() {
                if (tokens.length === 0) {
                  logo.current_def = { to: to, name: name.value, args: args,
                    source: input, tokens: [], is_macro: is_macro };
                  delete logo.scope.current_token;
                  f(undefined, false);
                } else if (tokens.length === 1) {
                  f(logo.error(logo.ERR_DOESNT_LIKE, $show(tokens[0])));
                } else {
                  var thing = tokens.shift();
                  var word = tokens.shift();
                  if (!thing.is_procedure("THING")) {
                    f(logo.error(logo.ERR_DOESNT_LIKE, $show(thing)));
                  } else if (!word.is_word) {
                    f(logo.error(logo.ERR_DOESNT_LIKE, $show(word)));
                  } else {
                    args.push(word.value);
                    read_var();
                  }
                }
              })();
            }
          }
        }
      } else {
        // Regular eval mode
        logo.eval_loop(tokens, function(error, value) {
            if (error) {
              f(error);
            } else if (tokens.length !== 0) {
              f(logo.error(ERR_INTERNAL, "There should be no input left?!"));
            } else {
              f(undefined, true);
            }
          });
      }
    } catch (error) {
      f(error);
    }
  };

  // Create an empty group
  logo.group = function(proto)
  {
    return logo.list(proto || logo.$group);
  };

  // Create an empty list
  logo.list = function(proto)
  {
    return logo.token([], undefined, proto || logo.$list);
  };

  // Create a procedure from its definition (name, arguments, source and tokens)
  logo.make_procedure = function(definition)
  {
    var p = function(tokens, f)
    {
      var scope = { parent: logo.scope,
        current_token: logo.scope.current_token,
        things: Object.create(logo.scope.things),
        exit: function(error, value) {
            logo.scope = logo.scope.parent;
            if (error) {
              f(error);
            } else if (definition.is_macro) {
              value.run(f);
            } else {
              f(error, value);
            }
          } };
      logo.scope = scope;
      var n = definition.args.length;
      (function eval_args(i) {
        if (i < n) {
          logo.eval(tokens, function(error, value) {
              if (error) {
                f(error);
              } else {
                logo.scope.things[definition.args[i].toUpperCase()] = value;
                eval_args(i + 1);
              }
            });
        } else {
          delete logo.scope.current_token;
          var tokens_ = definition.tokens.slice(0);
          logo.eval_loop(tokens_, function(error, value) {
              if (error) {
                f(error);
              } else if (tokens_.length !== 0) {
                f(logo.error(logo.ERR_INTERNAL,
                    "There should be no input left?!"));
              } else {
                logo.scope.exit(undefined, value);
              }
            });
        }
      })(0);
    };
    p._source = definition.source;
    return p;
  };

  // Create a new procedure token with the given name
  logo.procedure = function(value, surface, proto)
  {
    return logo.token(value, surface, proto || logo.$procedure);
  };

  // Read a function definition (after the title line, storing all tokens and
  // stopping when the single token "END" is found)
  logo.read_def = function(input, f)
  {
    if (!logo.current_def) {
      f(logo.error(ERR_INTERNAL, "No current definition?!"));
    }
    try {
      var tokens = logo.tokenize(input);
      logo.current_def.source += "\n" + input;
      if (tokens.length === 1 && tokens[0].is_procedure("END")) {
        // End function definition mode
        logo.procedures[logo.current_def.name] =
          logo.make_procedure(logo.current_def);
        logo.current_def = null;
        f(undefined, true, []);
      } else {
        logo.current_def.tokens = logo.current_def.tokens.concat(tokens);
        f(undefined, false, []);
      }
    } catch(e) {
      f(e);
    }
  };

  // Create a token; if no value is given, an undefined token is returned,
  // otherwise a word, unless a different prototype is given
  logo.token = function(value, surface, proto)
  {
    if (typeof value === "undefined") {
      return Object.create(logo.$undefined);
    } else {
      var token = Object.create(proto || logo.$word);
      token.value = value;
      if (surface) token.surface = surface;
      return token;
    }
  };

  // Tokenize an input string an return a list of tokens
  logo.tokenize = function(input)
  {
    var tokens = [];
    var m;
    var current_list = null;
    var current_group = null;
    var push_token = function(token)
    {
      if (current_list) {
        current_list.value.push(token);
      } else if (current_group) {
        current_group.value.push(token);
        if (current_group.value.length === 1) token.in_parens = true;
      } else {
        tokens.push(token);
      }
    }
    while (input.length > 0) {
      input = input.replace(/^\s+/, "");
      if (m = input.match(/^\[/)) {
        var l = logo.list();
        l.parent = current_list;
        push_token(l);
        current_list = l;
      } else if (m = input.match(/^\]/)) {
        if (current_list) {
          current_list = current_list.parent;
        } else {
          throw logo.error(logo.ERR_UNEXPECTED_BRACKET);
        }
      } else if (current_list) {
        m = input.match(/^[^\s\[\]]+/);
        push_token(logo.word(m[0]));
      } else if (m = input.match(/^\(/)) {
        var g = logo.group();
        g.parent = current_group;
        push_token(g);
        current_group = g;
      } else if (m = input.match(/^\)/)) {
        if (current_group) {
          current_group = current_group.parent;
        } else {
          throw logo.error(logo.ERR_UNEXPECTED_PAREN);
        }
      } else {
        if (m = input.match(/^"([^\s\[\]\(\);]*)/)) {
          push_token(logo.word(m[1], m[0]));
        } else if (m = input.match(/^((\d+(\.\d*)?)|(\d*\.\d+))/)) {
          push_token(logo.word(m[0], m[0]));
        } else if (m = input.match(/^(:?)([^\s\[\]\(\)+\-*\/=<>;]+)/)) {
          if (m[1] === ":") {
            push_token(logo.procedure("THING"));
            push_token(logo.word(m[2], m[0]));
          } else {
            push_token(logo.procedure(m[0].toUpperCase(), m[0]));
          }
        } else if (m = input.match(/^<=|>=|<>|./)) {
          push_token(logo.procedure(m[0]));
        }
      }
      if (m) input = input.substring(m[0].length);
    }
    return tokens;
  };

  // Create a word token of the correct type given the value (i.e. a word, a
  // number, an integer or a boolean.)
  logo.word = function(value, surface)
  {
    var proto = logo.$word;
    if (typeof value === "number") {
      proto = value === parseInt(value.toString(), 10) ?
        logo.$integer : logo.$number;
    } else if (/^[+-]?((\d+(\.\d*)?)|(\d*\.\d+))$/.test(value)) {
      var v = parseFloat(value);
      proto = isNaN(v) ? logo.$token :
        v === parseInt(value, 10) ? logo.$integer : logo.$number;
      value = isNaN(v) ? value : v;
    } else if (typeof value === "boolean") {
      proto = logo.$boolean;
    } else if (/^true$/i.test(value)) {
      proto = logo.$boolean;
      value = true;
    } else if (/^false$/i.test(value)) {
      proto = logo.$boolean;
      value = false;
    }
    return logo.token(value, surface, proto);
  };


  // Check the value of the current token, expecting a boolean; if it is a
  // list, evaluate the list then check the value, expecting a boolean. Call
  // the continuation on the success or error (not a boolean value.)
  function $check_tf(tf, f)
  {
    if (tf.is_true || tf.is_false) {
      f(undefined, tf);
    } else if (tf.is_list) {
      tf.run(function(error, value) {
          if (error) {
            f(error);
          } else {
            $check_tf(value, f);
          }
        });
    } else {
      f(logo.error(logo.ERR_DOESNT_LIKE, $show(tf)));
    }
  };

  // Helper function for a one-argument procedure. The function g must call the
  // continuation f itself.
  logo.eval_token = function(tokens, g, f)
  {
    logo.eval(tokens, function(error, value) {
        if (error) {
          f(error);
        } else {
          g(value);
        }
      });
  }

  // Same as above, except that before invoking g with the value received from
  // eval, the predicate p is applied to the value to check that this value is
  // what g expects (for instance, test for a word, a list, etc.)
  logo.eval_like = function(tokens, p, g, f)
  {
    logo.eval(tokens, function(error, value) {
        if (error) {
          f(error);
        } else if (!p(value)) {
          f(logo.error(logo.ERR_DOESNT_LIKE, $show(value)));
        } else {
          g(value);
        }
      });
  }

  // Eval a token, making sure that it is a list
  logo.eval_boolean = function(tokens, g, f)
  {
    logo.eval_like(tokens, function(t) { return t.is_true || t.is_false; },
        g, f);
  }

  logo.eval_integer = function(tokens, g, f)
  {
    logo.eval_like(tokens, function(t) { return t.is_integer; }, g, f);
  }

  logo.eval_list = function(tokens, g, f)
  {
    logo.eval_like(tokens, function(t) { return t.is_list; }, g, f);
  }

  logo.eval_number = function(tokens, g, f)
  {
    logo.eval_like(tokens, function(t) { return t.is_number; }, g, f);
  }

  logo.eval_word = function(tokens, g, f)
  {
    logo.eval_like(tokens, function(t) { return t.is_word; }, g, f);
  }

  // Wrapper around eval to slurp arguments within parens, or an expected
  // number of arguments. The function g gets called for each value with the
  // current accumulated value, initialized by init, and a continuation that it
  // must call on error or success with the new accumulated value.
  logo.eval_slurp = function(tokens, g, f, n, init)
  {
    (function slurp(m, acc) {
      if ((logo.scope.in_parens && tokens.length === 0) ||
        (!logo.scope.in_parens && m === 0)) {
        f(undefined, acc);
      } else {
        logo.eval(tokens, function(error, value) {
            if (error) {
              f(error);
            } else {
              g(value, acc, function(error, val) {
                  if (error) {
                    f(error);
                  } else {
                    slurp(m - 1, val);
                  }
                });
            }
          });
      }
    })(n, init);
  }

  // Wrapper for show to handle undefined values
  function $show(token)
  {
    return token && token.show ? token.show(true) : "undefined";
  }

  // IFTRUE and IFFALSE; i.e., functions that act of the last value of TEST
  function if_test(tokens, f, p)
  {
    if (typeof logo.scope.test !== "boolean") {
      f(logo.error(logo.ERR_NO_TEST));
    } else {
      logo.eval_token(tokens, function(list) {
          if (logo.scope.test !== p) {
            f(undefined, logo.token());
          } else {
            list.run(f);
          }
        }, f);
    }
  }


  // Predefined procedures; from http://www.cs.berkeley.edu/~bh/usermanual
  logo.procedures = {

    // AND tf1 tf2
    // (AND tf1 tf2 tf3 ...)
    //   outputs TRUE if all inputs are TRUE, otherwise FALSE.  All inputs
    //   must be TRUE or FALSE.  (Comparison is case-insensitive regardless
    //   of the value of CASEIGNOREDP.  That is, "true" or "True" or "TRUE"
    //   are all the same.)  An input can be a list, in which case it is
    //   taken as an expression to run; that expression must produce a TRUE
    //   or FALSE value.  List expressions are evaluated from left to right;
    //   as soon as a FALSE value is found, the remaining inputs are not
    //   examined.  Example:
    //     MAKE "RESULT AND [NOT (:X = 0)] [(1 / :X) > .5]
    //   to avoid the division by zero if the first part is false.
    AND: function(tokens, f)
    {
      var do_eval = true;
      logo.eval_slurp(tokens, function(tf, value, g) {
          if (do_eval) {
            $check_tf(tf, function(error, tf_) {
              if (error) {
                g(error);
              } else {
                if (tf_.is_false) do_eval = false;
                g(undefined, tf_);
              }
            });
          } else {
            g(undefined, value);
          }
        }, f, 2, logo.token());
    },

    // APPLY template inputlist
    //   command or operation.  Runs the "template," filling its slots with
    //   the members of "inputlist."  The number of members in "inputlist"
    //   must be an acceptable number of slots for "template."  It is
    //   illegal to apply the primitive TO as a template, but anything else
    //   is okay.  APPLY outputs what "template" outputs, if anything.
    APPLY: function(tokens, f)
    {

    },

    // ARCTAN num
    // (ARCTAN x y)
	  //   outputs the arctangent, in degrees, of its input.  With two
	  //   inputs, outputs the arctangent of y/x, if x is nonzero, or
    //   90 or -90 depending on the sign of y, if x is zero.
    ARCTAN: function(tokens, f)
    {
      if (logo.scope.in_parens) {
        logo.eval_number(tokens, function(x) {
            logo.eval_number(tokens, function(y) {
                if (x === 0) {
                  f(undefined, logo.word(populus.sign(y) * 90));
                } else {
                  f(undefined, logo.word(Math.atan(y / x) * 180 / Math.PI));
                }
              }, f);
          }, f);
      } else {
        logo.eval_number(tokens, function(num) {
            f(undefined, logo.word(Math.atan(num) * 180 / Math.PI));
          }, f);
      }
    },

    // BUTFIRST wordorlist
    // BF wordorlist
    //   if the input is a word, outputs a word containing all but the first
    //   character of the input.  If the input is a list, outputs a list
    //   containing all but the first member of the input.
    BUTFIRST: function(tokens, f)
    {
      logo.eval_token(tokens, function(v) { f(undefined, v.butfirst()); }, f);
    },

    // BUTLAST wordorlist
    // BL wordorlist
    //   if the input is a word, outputs a word containing all but the last
    //   character of the input.  If the input is a list, outputs a list
    //   containing all but the last member of the input.
    BUTLAST: function(tokens, f)
    {
      logo.eval_token(tokens, function(v) { f(undefined, v.butlast()); }, f);
    },

    // COPYDEF newname oldname
    //   command.  Makes "newname" a procedure identical to "oldname".
    //   The latter may be a primitive.  If "newname" was already defined,
    //   its previous definition is lost.  If "newname" was already a
    //   primitive, the redefinition is not permitted unless the variable
    //   REDEFP has the value TRUE.
    //   Note: dialects of Logo differ as to the order of inputs to COPYDEF.
    //   This dialect uses "MAKE order," not "NAME order."
    COPYDEF: function(tokens, f)
    {
      logo.eval_word(tokens, function(newname) {
          var n = newname.value.toUpperCase();
          if (n in logo.procedures && !n._source) {
            f(logo.error(logo.ERR_ALREADY_DEFINED, $show(newname)));
          } else {
            logo.eval_word(tokens, function(oldname) {
                var o = oldname.value.toUpperCase();
                var p = logo.procedures[o];
                if (!p) {
                  f(logo.error(logo.ERR_HOW_TO_FATAL, $show(oldname)));
                } else {
                  logo.procedures[n] = p;
                  f(undefined, logo.token());
                }
              }, f);
          }
        }, f);
    },

    // COS degrees
	  //   outputs the cosine of its input, which is taken in degrees.
    COS: function(tokens, f)
    {
      logo.eval_number(tokens, function(degrees) {
          f(undefined, logo.word(Math.cos(degrees * Math.PI / 180)));
        }, f);
    },

    // COUNT thing
    //   outputs the number of characters in the input, if the input is a word;
    //   outputs the number of members in the input, if it is a list or an
    //   array.  (For an array, this may or may not be the index of the
    //   last member, depending on the array's origin.)
    //   TODO arrays
    COUNT: function(tokens, f)
    {
      logo.eval_token(tokens, function(v) {
          f(undefined, logo.word(v.count));
        }, f);
    },

    // DIFFERENCE num1 num2
    // TODO num1 - num2
    //   outputs the difference of its inputs.  Minus sign means infix
    //   difference in ambiguous contexts (when preceded by a complete
    //   expression), unless it is preceded by a space and followed
    //   by a nonspace.  (See also MINUS.)
    DIFFERENCE: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.word(num1.value - num2.value));
            }, f);
        }, f);
    },

    // EMPTYP thing
    // EMPTY? thing
    //   outputs TRUE if the input is the empty word or the empty list,
    //   FALSE otherwise.
    EMPTYP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          f(undefined, logo.word(thing.count === 0))
        }, f);
    },

    // EQUALP thing1 thing2
    // EQUAL? thing1 thing2
    // TODO thing1 = thing2
    //   outputs TRUE if the inputs are equal, FALSE otherwise.  Two numbers
    //   are equal if they have the same numeric value.  Two non-numeric words
    //   are equal if they contain the same characters in the same order.  If
    //   there is a variable named CASEIGNOREDP whose value is TRUE, then an
    //   upper case letter is considered the same as the corresponding lower
    //   case letter.  (This is the case by default.)  Two lists are equal if
    //   their members are equal.  An array is only equal to itself; two
    //   separately created arrays are never equal even if their members are
    //   equal.  (It is important to be able to know if two expressions have
    //   the same array as their value because arrays are mutable; if, for
    //   example, two variables have the same array as their values then
    //   performing SETITEM on one of them will also change the other.)
    EQUALP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing1) {
          logo.eval_token(tokens, function(thing2) {
              f(undefined, logo.word(thing1.equalp(thing2)));
            }, f);
        }, f);
    },

    // EXP num
	  //   outputs e (2.718281828+) to the input power.
    EXP: function(num)
    {
      logo.eval_number(tokens, function(num) {
          f(undefined, logo.word(Math.exp(num)));
        }, f);
    },

    // FIRST thing
	  //   if the input is a word, outputs the first character of the word.
    //   If the input is a list, outputs the first member of the list.
    //   If the input is an array, outputs the origin of the array (that is,
    //   the INDEX OF the first member of the array).
    //   TODO arrays
    FIRST: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          f(undefined, thing.item(1));
        }, f);
    },

    // FIRSTS list
    //   outputs a list containing the FIRST of each member of the input
    //   list.  It is an error if any member of the input list is empty.
    //   (The input itself may be empty, in which case the output is also
    //   empty.)  This could be written as
		//     to firsts :list
    //     output map "first :list
    //     end
	  //   but is provided as a primitive in order to speed up the iteration
    //   tools MAP, MAP.SE, and FOREACH.
		//     to transpose :matrix
    //     if emptyp first :matrix [op []]
    //     op fput firsts :matrix transpose bfs :matrix
    //     end
    FIRSTS: function(tokens, f)
    {
      var firsts = logo.list();
      logo.eval_list(tokens, function(list) {
          var error;
          for (var i = 0, n = list.value.length, error; i < n && !error; ++i) {
            var v = list.value[i];
            if (typeof v.count !== "number" || v.count === 0) {
              error = logo.error(logo.ERR_DOESNT_LIKE, $show(v));
            } else {
              firsts.value.push(v.item(1));
            }
          }
          if (error) {
            f(error);
          } else {
            f(undefined, firsts);
          }
        }, f);
    },

    // FOREVER instructionlist
	  //   command.  Runs the "instructionlist" repeatedly, until something
    //   inside the instructionlist (such as STOP or THROW) makes it stop.
    FOREVER: function(tokens, f)
    {
      logo.eval_list(tokens, function(list) {
          var scope = Object.create(logo.scope);
          scope.parent = logo.scope;
          scope.repcount = 0;
          scope.exit = function(error, value) {
            logo.scope = logo.scope.parent;
            logo.scope.exit(error, value);
          }
          logo.scope = scope;
          (function repeat() {
            ++logo.scope.repcount;
            list.run(repeat);
          })();
        }, f);
    },

    // FPUT thing list
    //   outputs a list equal to its second input with one extra member,
    //   the first input, at the beginning.  If the second input is a word,
    //   then the first input must be a one-letter word, and FPUT is
    //   equivalent to WORD.
    FPUT: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          logo.eval_token(tokens, function(list) {
              f(undefined, list.fput(thing));
            }, f);
        }, f);
    },

    // GREATEREQUALP num1 num2
    // GREATEREQUAL? num1 num2
    // (TODO) num1 >= num2
    //   outputs TRUE if its first input is greater than or equal to its second.
    GREATEREQUALP: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.word(num1 >= num2));
            }, f);
        }, f);
    },

    // GREATERP num1 num2
    // GREATER? num1 num2
    // (TODO) num1 > num2
    //   outputs TRUE if its first input is strictly greater than its second.
    GREATERP: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.word(num1 > num2));
            }, f);
        }, f);
    },

    // IF tf instructionlist
    // (IF tf instructionlist1 instructionlist2)
	  //   command.  If the first input has the value TRUE, then IF runs
    //   the second input.  If the first input has the value FALSE, then
    //   IF does nothing.  (If given a third input, IF acts like IFELSE,
    //   as described below.)  It is an error if the first input is not
    //   either TRUE or FALSE.
    //   For compatibility with earlier versions of Logo, if an IF
    //   instruction is not enclosed in parentheses, but the first thing
    //   on the instruction line after the second input expression is a
    //   literal list (i.e., a list in square brackets), the IF is
    //   treated as if it were IFELSE, but a warning message is given.
    //   If this aberrant IF appears in a procedure body, the warning is
    //   given only the first time the procedure is invoked in each Logo
    //   session.
    IF: function(tokens, f)
    {
      logo.eval_boolean(tokens, function(tf) {
          logo.eval_list(tokens, function(list_then) {
              if ((logo.scope.in_parens && tokens.length > 0 ||
                  tokens.length > 0 && tokens[0].is_list)) {
                if (!logo.scope.in_parens) {
                  logo.warn(logo.error(logo.ERR_ASSUMING_IFELSE));
                }
                logo.eval_list(tokens, function(list_else) {
                    if (tf.is_true) {
                      list_then.run(f);
                    } else {
                      list_else.run(f);
                    }
                  }, f);
              } else if (tf.is_true) {
                list_then.run(f);
              } else {
                f(undefined, logo.token());
              }
            }, f);
        }, f);
    },

    // IFELSE tf instructionlist1 instructionlist2
    //   command or operation.  If the first input has the value TRUE, then
    //   IFELSE runs the second input.  If the first input has the value FALSE,
    //   then IFELSE runs the third input.  IFELSE outputs a value if the
    //   instructionlist contains an expression that outputs a value.
    IFELSE: function(tokens, f)
    {
      logo.eval_boolean(tokens, function(tf) {
          logo.eval_list(tokens, function(list_then) {
              logo.eval_list(tokens, function(list_else) {
                  if (tf.is_true) {
                    list_then.run(f);
                  } else {
                    list_else.run(f);
                  }
                }, f);
            }, f);
        }, f);
    },

    // IFFALSE instructionlist
    // IFF instructionlist
	  //   command.  Runs its input if the most recent TEST instruction had
    //   a FALSE input.  The TEST must have been in the same procedure or a
    //   superprocedure.
    IFFALSE: function(tokens, f) { if_test(tokens, f, false); },

    // IFTRUE instructionlist
    // IFT instructionlist
	  //   command.  Runs its input if the most recent TEST instruction had
    //   a TRUE input.  The TEST must have been in the same procedure or a
    //   superprocedure.
    IFTRUE: function(tokens, f) { if_test(tokens, f, true); },

    // INT num
	  //   outputs its input with fractional part removed, i.e., an integer
    //   with the same sign as the input, whose absolute value is the
    //   largest integer less than or equal to the absolute value of
    //   the input.
    INT: function(tokens, f)
    {
      logo.eval_number(tokens, function(num) {
          f(undefined, logo.word(Math.floor(num)));
        }, f);
    },

    // ITEM index thing
	  //   if the "thing" is a word, outputs the "index"th character of the
    //   word.  If the "thing" is a list, outputs the "index"th member of
    //   the list.  If the "thing" is an array, outputs the "index"th
    //   member of the array.  "Index" starts at 1 for words and lists;
    //   the starting index of an array is specified when the array is created.
    //   TODO array
    ITEM: function(tokens, f)
    {
      logo.eval_integer(tokens, function(index) {
          logo.eval_token(tokens, function(thing) {
              f(undefined, thing.item(index));
            }, f);
        }, f);
    },

    // LAST wordorlist
	  //   if the input is a word, outputs the last character of the word.
    //   If the input is a list, outputs the last member of the list.
    LAST: function(tokens, f)
    {
      logo.eval_token(tokens, function(v) {
          f(undefined, v.item(v.count));
        }, f);
    },

    // LESSEQUALP num1 num2
    // LESSEQUAL? num1 num2
    // (TODO) num1 <= num2
    //   outputs TRUE if its first input is less than or equal to its second.
    LESSEQUALP: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.word(num1 <= num2));
            }, f);
        }, f);
    },

    // LESSP num1 num2
    // LESS? num1 num2
    // (TODO) num1 < num2
    //   outputs TRUE if its first input is strictly less than its second.
    LESSP: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.word(num1 < num2));
            }, f);
        }, f);
    },

    // LIST thing1 thing2
    // (LIST thing1 thing2 thing3 ...)
    //   outputs a list whose members are its inputs, which can be any
    //   Logo datum (word, list, or array).
    LIST: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(v, list, g) {
          list.value.push(v);
          g(undefined, list);
        }, f, 2, logo.list());
    },

    // LISTP thing
    // LIST? thing
    //   outputs TRUE if the input is a list, FALSE otherwise.
    LISTP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          f(undefined, logo.word(thing.is_list));
        }, f);
    },

    // LOCAL varname
    // LOCAL varnamelist
    // (LOCAL varname1 varname2 ...)
    //   command.  Accepts as inputs one or more words, or a list of
    //   words.  A variable is created for each of these words, with
    //   that word as its name.  The variables are local to the
    //   currently running procedure.  Logo variables follow dynamic
    //   scope rules; a variable that is local to a procedure is
    //   available to any subprocedure invoked by that procedure.
    //   The variables created by LOCAL have no initial value; they
    //   must be assigned a value (e.g., with MAKE) before the procedure
    //   attempts to read their value.
    LOCAL: function(tokens, f)
    {
      var varnames = [];
      if (logo.scope.in_parens) {
        (function slurp() {
          if (tokens.length > 0) {
            logo.eval_word(tokens, function(varname) {
                varnames.push(varname);
                slurp();
              }, f);
          }
        })();
      } else {
        logo.eval_token(tokens, function(thing) {
            if (thing.is_word) {
              varnames.push(thing);
            } else {
              varnames = thing.value.slice(0);
            }
          });
      }
      (function local() {
        if (varnames.length === 0) {
          f(undefined, logo.word());
        } else {
          var varname = varnames.shift();
          if (!varname.is_word) {
            f(logo.error(logo.ERR_DOESNT_LIKE, $show(varname)));
          } else {
            logo.scope.things[varname.toString().toUpperCase()] = null;
            local();
          }
        }
      })();
    },

    // LN num
	  //   outputs the natural logarithm of the input.
    LN: function(tokens, f)
    {
      logo.eval_number(tokens, function(num) {
          f(undefined, logo.word(Math.log(num)));
        }, f);
    },

    // LOG10 num
    //   outputs the common logarithm of the input.
    LOG10: function(tokens, f)
    {
      logo.eval_number(tokens, function(num) {
          f(undefined, logo.word(Math.log(num) / Math.log(10)));
        }, f);
    },

    // LPUT thing list
    //   outputs a list equal to its second input with one extra member,
    //   the first input, at the end.  If the second input is a word,
    //   then the first input must be a one-letter word, and LPUT is
    //   equivalent to WORD with its inputs in the other order.
    LPUT: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          logo.eval_token(tokens, function(list) {
              f(undefined, list.lput(thing));
            }, f);
        }, f);
    },

    // MAKE varname value
    //   command.  Assigns the value "value" to the variable named "varname",
    //   which must be a word.  Variable names are case-insensitive.  If a
    //   variable with the same name already exists, the value of that
    //   variable is changed.  If not, a new global variable is created.
    MAKE: function(tokens, f)
    {
      logo.eval_word(tokens, function(varname) {
          var name = varname.value.toUpperCase();
          logo.eval_token(tokens, function(value) {
              if (logo.scope.things.hasOwnProperty(name)) {
                logo.scope.things[name] = value;
              } else {
                logo.scope_global.things[name] = value;
              }
              f(undefined, logo.word());
            }, f);
        }, f);
    },

    // MEMBERP thing1 thing2
    // MEMBER? thing1 thing2
    //   if "thing2" is a list or an array, outputs TRUE if "thing1" is EQUALP
    //   to a member of "thing2", FALSE otherwise.  If "thing2" is
    //   a word, outputs TRUE if "thing1" is a one-character word EQUALP to a
    //   character of "thing2", FALSE otherwise.
    MEMBERP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing1) {
          logo.eval_token(tokens, function(thing2) {
              f(undefined, logo.word(thing2.contains(thing1)));
            }, f);
        }, f);
    },

    // MINUS num
    // TODO - num
    //   outputs the negative of its input.  Minus sign means unary minus if
    //   the previous token is an infix operator or open parenthesis, or it is
    //   preceded by a space and followed by a nonspace.  There is a difference
    //   in binding strength between the two forms:
    //     MINUS 3 + 4	means	-(3+4)
    //     - 3 + 4		means	(-3)+4
    MINUS: function(tokens, f)
    {
      logo.eval_number(tokens, function(num) {
          f(undefined, logo.word(-num));
        }, f);
    },

    // MODULO num1 num2
	  //   outputs the remainder on dividing "num1" by "num2"; both must be
    //   integers and the result is an integer with the same sign as num2.
    MODULO: function(tokens, f)
    {
      logo.eval_integer(tokens, function(num1) {
          logo.eval_integer(tokens, function(num2) {
              f(undefined,
                logo.word(populus.sign(num2) * Math.abs(num1 % num2)));
            }, f);
        }, f);

    },

    // NOTEQUALP thing1 thing2
    // NOTEQUAL? thing1 thing2
    // TODO thing1 <> thing2
    //   outputs FALSE if the inputs are equal, TRUE otherwise.  See EQUALP
    //   for the meaning of equality for different data types.
    NOTEQUALP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing1) {
          logo.eval_token(tokens, function(thing2) {
              f(undefined, logo.word(!thing1.equalp(thing2)));
            }, f);
        }, f);
    },

    // OR tf1 tf2
    // (OR tf1 tf2 tf3 ...)
	  //   outputs TRUE if any input is TRUE, otherwise FALSE.  All inputs
    //   must be TRUE or FALSE.  (Comparison is case-insensitive regardless
    //   of the value of CASEIGNOREDP.  That is, "true" or "True" or "TRUE"
    //   are all the same.)  An input can be a list, in which case it is
    //   taken as an expression to run; that expression must produce a TRUE
    //   or FALSE value.  List expressions are evaluated from left to right;
    //   as soon as a TRUE value is found, the remaining inputs are not
    //   examined.  Example:
    //     IF OR :X=0 [some.long.computation] [...]
    //   to avoid the long computation if the first condition is met.
    OR: function(tokens, f)
    {
      var do_eval = true;
      logo.eval_slurp(tokens, function(tf, value, g) {
          if (do_eval) {
            $check_tf(tf, function(error, tf_) {
              if (error) {
                g(error);
              } else {
                if (tf_.is_true) do_eval = false;
                g(undefined, tf_);
              }
            });
          } else {
            g(undefined, value);
          }
        }, f, 2, logo.token());
    },

    // OUTPUT value
    // OP value
	  //   command.  Ends the running of the procedure in which it appears.
    //   That procedure outputs the value "value" to the context in which
    //   it was invoked.  Don't be confused: OUTPUT itself is a command,
    //   but the procedure that invokes OUTPUT is an operation.
    OUTPUT: function(tokens, f)
    {
      logo.eval_token(tokens, function(value) {
          logo.scope.exit(undefined, value);
        }, f);
    },

    // POWER num1 num2
	  //   outputs "num1" to the "num2" power.  If num1 is negative, then
    //   num2 must be an integer.
    POWER: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo["eval_" + (num1 < 0 ? "integer" : "number")](tokens,
            function(num2) {
              f(undefined, logo.word(Math.pow(num1, num2)));
            }, f);
        }, f);
    },

    // PRIMITIVES
    //   outputs a list of the names of all primitive procedures
    //   in the workspace.  Note that this is a list of names, not a
    //   contents list.  (However, procedures that require a contents list
    //   as input will accept this list.)
    PRIMITIVES: function(tokens, f)
    {
      var list = logo.list();
      for (var p in logo.procedures) {
        if (!logo.procedures[p]._source) list.value.push(logo.word(p));
      }
      f(undefined, list);
    },

    // PRINT thing
    // PR thing
    // (PRINT thing1 thing2 ...)
    // (PR thing1 thing2 ...)
    //   command.  Prints the input or inputs to the current write stream
    //   (initially the screen).  All the inputs are printed on a single
    //   line, separated by spaces, ending with a newline.  If an input is a
    //   list, square brackets are not printed around it, but brackets are
    //   printed around sublists.  Braces are always printed around arrays.
    //   TODO streams, arrays
    PRINT: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(v, _, g) {
          logo.print(v.toString());
          g(undefined, logo.token());
        }, f, 1);
    },

    // PRODUCT num1 num2
    // (PRODUCT num1 num2 num3 ...)
    // TODO num1 * num2
    //   outputs the product of its inputs.
    PRODUCT: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(n, product, g) {
          if (!n.is_number) {
            g(logo.error(logo.ERR_DOESNT_LIKE, $show(n)));
          } else {
            g(undefined, logo.word(n.value * product.value));
          }
        }, f, 2, logo.word(1));
    },

    // PRINTOUT contentslist
    // PO contentslist
	  //   command.  Prints to the write stream the definitions of all
	  //    procedures, variables, and property lists named in the input
    //    contents list.
    PRINTOUT: function(tokens, f)
    {
      logo.eval_token(tokens, function(list) {
          var words = list.is_word ? [list] : list.value.slice(0);
          (function po() {
            if (words.length === 0) {
              f(undefined, logo.token());
            } else {
              var word = words.shift();
              if (!word.is_word) {
                f(logo.error(logo.ERR_DOESNT_LIKE, $show(word)));
              } else {
                var p = logo.procedures[word.value.toUpperCase()];
                if (!p) {
                  f(logo.error(logo.ERR_DOESNT_LIKE, $show(word)));
                } else if (!p._source) {
                  f(logo.error(logo.ERR_IS_A_PRIMITIVE, $show(word)));
                } else {
                  logo.print(p._source);
                  po();
                }
              }
            }
          })();
        }, f);
    },

    // QUOTIENT num1 num2
    // (QUOTIENT num)
    // TODO num1 / num2
    //   outputs the quotient of its inputs.  The quotient of two integers
    //   is an integer if and only if the dividend is a multiple of the divisor.
    //   (In other words, QUOTIENT 5 2 is 2.5, not 2, but QUOTIENT 4 2 is
    //   2, not 2.0 -- it does the right thing.)  With a single input,
    //   QUOTIENT outputs the reciprocal of the input.
    QUOTIENT: function(tokens, f)
    {
      if (logo.scope.in_parens) {
        logo.eval_number(tokens, function(num) {
            f(undefined, logo.word(1 / num.value));
          }, f);
      } else {
        logo.eval_number(tokens, function(num1) {
            logo.eval_number(tokens, function(num2) {
                f(undefined, logo.word(num1 / num2));
              }, f);
          }, f);
      }
    },

    // RADARCTAN num
    // (RADARCTAN x y)
	  //   outputs the arctangent, in radians, of its input.  With two
	  //   inputs, outputs the arctangent of y/x, if x is nonzero, or
    //   pi/2 or -pi/2 depending on the sign of y, if x is zero.
    //   The expression 2*(RADARCTAN 0 1) can be used to get the
    //   value of pi.
    RADARCTAN: function(tokens, f)
    {
      if (logo.scope.in_parens) {
        logo.eval_number(tokens, function(x) {
            logo.eval_number(tokens, function(y) {
                if (x === 0) {
                  f(undefined, logo.word(populus.sign(y) * Math.PI / 2));
                } else {
                  f(undefined, logo.word(Math.atan(y / x)));
                }
              }, f);
          }, f);
      } else {
        logo.eval_number(tokens, function(num) {
            f(undefined, logo.word(Math.atan(num)));
          }, f);
      }
    },

    // RADCOS radians
	  //   outputs the cosine of its input, which is taken in radians.
    RADCOS: function(tokens, f)
    {
      logo.eval_number(tokens, function(radians) {
          f(undefined, logo.word(Math.cos(radians)));
        }, f);
    },

    // RADSIN radians
	  //   outputs the sine of its input, which is taken in radians.
    RADSIN: function(tokens, f)
    {
      logo.eval_number(tokens, function(radians) {
          f(undefined, logo.word(Math.sin(radians)));
        }, f);
    },

    // RANDOM num
    // (RANDOM start end)
	  //   with one input, outputs a random nonnegative integer less than its
    //   input, which must be a positive integer.
    //   With two inputs, RANDOM outputs a random integer greater than or
    //   equal to the first input, and less than or equal to the second
    //   input.  Both inputs must be integers, and the first must be less
    //   than the second.  (RANDOM 0 9) is equivalent to RANDOM 10;
    //   (RANDOM 3 8) is equivalent to (RANDOM 6)+3.
    RANDOM: function(tokens, f)
    {
      function random_int(max)
      {
        var bits = Math.ceil(Math.log(max) / Math.log(2));
        if (bits === 0) return 0;
        for (var n = max; n >= max; n = MERSENNE_TWISTER.$next(bits));
        return n;
      }
      if (logo.scope.in_parens) {
        logo.eval_integer(tokens, function(start) {
            logo.eval_integer(tokens, function(end) {
                if (end - start < 0) {
                  f(logo.error(logo.ERR_DOESNT_LIKE, $show(start)));
                } else {
                  f(undefined, logo.word(start.value +
                      random_int(end - start + 1)));
                }
              }, f);
          }, f);
      } else {
        logo.eval_integer(tokens, function(num) {
            if (num < 1) {
              f(logo.error(logo.ERR_DOESNT_LIKE, $show(num)));
            } else {
              f(undefined, logo.word(random_int(num)));
            }
          }, f);
      }
    },

    // READLIST
    // RL
    //   reads a line from the read stream (initially the keyboard) and
    //   outputs that line as a list.  The line is separated into members as
    //   though it were typed in square brackets in an instruction.  If the
    //   read stream is a file, and the end of file is reached, READLIST
    //   the output list will not contain these characters but they will have
    //   had their usual effect.  READLIST does not, however, treat semicolon
    //   as a comment character.
    //   TODO special characters
    READLIST: function(tokens, f)
    {
      logo.read(function(input) {
          try {
            var list = logo.tokenize("[" + input + "]")[0];
            if (list.is_list) {
              f(undefined, list);
            } else {
              f(logo.error(logo.ERR_INTERNAL,
                    "{1} is not a list?!".fmt($show(list))));
            }
          } catch(e) {
            f(e);
          }
        });
    },

    // REMAINDER num1 num2
    //   outputs the remainder on dividing "num1" by "num2"; both must be
    //   integers and the result is an integer with the same sign as num1.
    REMAINDER: function(tokens, f)
    {
      logo.eval_integer(tokens, function(num1) {
          logo.eval_integer(tokens, function(num2) {
              f(undefined,
                logo.word(populus.sign(num1) * Math.abs(num1 % num2)));
            }, f);
        }, f);
    },

    // REPCOUNT
	  //   outputs the repetition count of the innermost current REPEAT or
    //   FOREVER, starting from 1.  If no REPEAT or FOREVER is active,
    //   outputs -1.
	  //   The abbreviation # can be used for REPCOUNT unless the REPEAT is
    //   inside the template input to a higher order procedure such as
    //   FOREACH, in which case # has a different meaning. (TODO)
    REPCOUNT: function(tokens, f)
    {
      f(undefined, logo.word(logo.scope.repcount || -1));
    },

    // REPEAT num instructionlist
	  //   command.  Runs the "instructionlist" repeatedly, "num" times.
    REPEAT: function(tokens, f)
    {
      logo.eval_integer(tokens, function(num) {
          logo.eval_list(tokens, function(list) {
              var scope = Object.create(logo.scope);
              scope.parent = logo.scope;
              scope.repcount = 0;
              logo.scope = scope;
              (function repeat() {
                if (num <= 0) {
                  logo.scope = logo.scope.parent;
                  f();
                } else {
                  --num;
                  ++logo.scope.repcount;
                  list.run(repeat);
                }
              })();
            }, f);
        }, f);
    },

    // RERANDOM
    // (RERANDOM seed)
    //   command.  Makes the results of RANDOM reproducible.  Ordinarily
    //   the sequence of random numbers is different each time Logo is
    //   used.  If you need the same sequence of pseudo-random numbers
    //   repeatedly, e.g. to debug a program, say RERANDOM before the
    //   first invocation of RANDOM.  If you need more than one repeatable
    //   sequence, you can give RERANDOM an integer input; each possible
    //   input selects a unique sequence of numbers.
    RERANDOM: function(tokens, f)
    {
      if (logo.scope.in_parens) {
        logo.eval_integer(tokens, function(seed) {
            MERSENNE_TWISTER.set_seed(seed.value);
            f();
          }, f);
      } else {
        MERSENNE_TWISTER.set_seed(1305301824911);
        f();
      }
    },

    // ROUND num
	  // outputs the nearest integer to the input.
    ROUND: function(tokens, f)
    {
      logo.eval_number(tokens, function(num) {
          f(undefined, logo.word(Math.round(num)));
        }, f);
    },

    // RUN instructionlist
	  //   command or operation.  Runs the Logo instructions in the input
    //   list; outputs if the list contains an expression that outputs.
    RUN: function(tokens, f)
    {
      logo.eval_list(tokens, function(list) { list.run(f); }, f);
    },

    // RUNRESULT instructionlist
	  //   runs the instructions in the input; outputs an empty list if
    //   those instructions produce no output, or a list whose only
    //   member is the output from running the input instructionlist.
    //   Useful for inventing command-or-operation control structures:
    //     local "result
    //     make "result runresult [something]
    //     if emptyp :result [stop]
    //     output first :result
    RUNRESULT: function(tokens, f)
    {
      logo.eval_list(tokens, function(list) {
          list.run(function(error, value) {
              if (error) {
                f(error);
              } else {
                var out = logo.list();
                if (value.is_defined) out.value.push(value);
                f(undefined, out);
              }
            });
        }, f);
    },

    // SENTENCE thing1 thing2
    // SE thing1 thing2
    // (SENTENCE thing1 thing2 thing3 ...)
    // (SE thing1 thing2 thing3 ...)
    //   outputs a list whose members are its inputs, if those inputs are
    //   not lists, or the members of its inputs, if those inputs are lists.
    SENTENCE: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(thing, sentence, g) {
          if (thing.is_list) {
            sentence.value = sentence.value.concat(thing.value);
          } else {
            sentence.value.push(thing);
          }
          g(undefined, sentence);
        }, f, 2, logo.list());
    },

    // SHOW thing
    // (SHOW thing1 thing2 ...)
    //   command.  Prints the input or inputs like PRINT, except that
    //   if an input is a list it is printed inside square brackets.
    SHOW: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(v, _, g) {
          logo.print(v.show());
          g(undefined, logo.token());
        }, f, 1);
    },

    // SIN degrees
	  //   outputs the sine of its input, which is taken in degrees.
    SIN: function(tokens, f)
    {
      logo.eval_number(tokens, function(degrees) {
          f(undefined, logo.word(Math.sin(degrees * Math.PI / 180)));
        }, f);
    },

    // SQRT num
	  //   outputs the square root of the input, which must be nonnegative.
    SQRT: function(tokens, f)
    {
      logo.eval_number(tokens, function(num) {
          if (num < 0) {
            f(logo.error(logo.ERR_DOESNT_LIKE, $show(num)));
          } else {
            f(undefined, logo.word(Math.sqrt(num)));
          }
        }, f);
    },

    // STOP
	  //   command.  Ends the running of the procedure in which it appears.
    //   Control is returned to the context in which that procedure was
    //   invoked.  The stopped procedure does not output a value.
    STOP: function(tokens, f) { logo.scope.exit(undefined, logo.token()); },

    // SUM num1 num2
    // (SUM num1 num2 num3 ...)
    // TODO num1 + num2
    //   outputs the sum of its inputs.
    SUM: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(n, sum, g) {
          if (!n.is_number) {
            g(logo.error(logo.ERR_DOESNT_LIKE, $show(n)));
          } else {
            g(undefined, logo.word(n.value + sum.value));
          }
        }, f, 2, logo.word(0));
    },

    // TEST tf
	  //   command.  Remembers its input, which must be TRUE or FALSE, for use
    //   by later IFTRUE or IFFALSE instructions.  The effect of TEST is local
    //   to the procedure in which it is used; any corresponding IFTRUE or
    //   IFFALSE must be in the same procedure or a subprocedure.
    TEST: function(tokens, f)
    {
      logo.eval_token(tokens, function(tf) {
          if (!(tf.is_true() || tf.is_false())) {
            f(logo.error(logo.ERR_DOESNT_LIKE, $show(tf)));
          } else {
            logo.scope.test = tf.is_true;
            f(undefined, logo.token());
          }
        }, f);
    },

    // THING varname
    // :quoted.varname
	  //   outputs the value of the variable whose name is the input.
    //   If there is more than one such variable, the innermost local
    //   variable of that name is chosen.  The colon notation is an
    //   abbreviation not for THING but for the combination
		//		 thing "
    //   so that :FOO means THING "FOO.
    THING: function(tokens, f)
    {
      logo.eval_word(tokens, function(varname) {
          var val = logo.scope.things[varname.value.toUpperCase()];
          if (val) {
            f(undefined, val);
          } else {
            f(logo.error(logo.ERR_NO_VAR, $show(varname)));
          }
        }, f);
    },

    // TO is handled in a special manner
    TO: function(tokens, f) { f(logo.error(logo.ERR_CANT_USE_HERE)); },

    // WAIT time
    //   command.  Delays further execution for "time" 60ths of a second.
    //   Also causes any buffered characters destined for the terminal to
    //   be printed immediately.  WAIT 0 can be used to achieve this
    //   buffer flushing without actually waiting.
    // TODO something about buffering in Node (if any)
    WAIT: function(tokens, f)
    {
      logo.eval_number(tokens, function(time) {
          if (time < 0) {
            f(logo.error(logo.ERR_DOESNT_LIKE, $show(time)));
          } else {
            setTimeout(f, time * 1000 / 60);
          }
        }, f);
    },

    // WORD word1 word2
    // (WORD word1 word2 word3 ...)
    //   outputs a word formed by concatenating its inputs.
    WORD: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(v, w, g) {
          if (!v.is_word) {
            g(logo.error(logo.ERR_DOESNT_LIKE, $show(v)));
          } else {
            g(undefined, logo.word(w.toString() + v.toString()));
          }
        }, f, 2, logo.word(""));
    },

    // WORDP thing
    // WORD? thing
    //   outputs TRUE if the input is a word, FALSE otherwise.
    WORDP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          f(undefined, logo.word(thing.is_word));
        }, f);
    },


    // My own extensions

    // Show internals of values, used for debugging
    SHOWINTERNALS: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(v, _, g) {
          logo.print(v.show_internals());
          g(undefined, logo.token());
        }, f, 1);
    },
  };

}(typeof exports === "undefined" ? this.logo = {} : exports));
