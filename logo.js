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


// Simple format function for messages. Use {0}, {1}... as slots for
// parameters. Missing parameters are replaced with the empty string.
// Example: "The value of {0} is {1}".fmt(name, value)
String.prototype.fmt = function()
{
  var args = Array.prototype.slice.call(arguments);
  return this.replace(/{(\d+)}/g, function(_, n) {
      return typeof args[n] === "undefined" ? "" : args[n];
    });
};

// Functions in the logo namespace, or exported to a logo module if used with
// node.js
(function(logo) {

  // TODO these shouldn't be global but passed around as the execution context
  logo.scope_global = logo.scope = { things: {} };


  // Create a token with the value TRUE or FALSE depending on the predicate p
  logo.bool = function(p)
  {
    return logo.token(p ? "TRUE" : "FALSE");
  }

  // Make an error object from the given error code and additional arguments.
  // The first argument is implied to be the current procedure (if any.) An
  // error object has a code and a message field.
  logo.error = function(code)
  {
    var msg = logo.error_messages[code] || "Unknown error ({0})".fmt(code);
    var args = Array.prototype.slice.call(arguments, 1);
    // Add the current word to the list of argument
    args.unshift($show(logo.scope.current_procedure));
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
    try {
      var tokens = logo.tokenize(input);
      if (tokens.length > 0 && tokens[0].is_procedure("TO")) {
        if (logo.current_def) {
          f(logo.error(ERR_INTERNAL, "Shouldn't be in eval mode here?!"));
        } else {
          var args = [];
          var to = logo.scope.current_procedure = tokens.shift();
          if (tokens.length > 0) {
            // Read the name of the procedure
            var name = tokens.shift();
            if (!name.is_word()) {
              f(logo.error(logo.ERR_DOESNT_LIKE, $show(name)));
            } else if (name in logo.procedures) {
              f(logo.error(logo.ERR_ALREADY_DEFINED, $show(name)));
            } else {
              // Read args: they are pairs of THING followed by a word
              (function read_var() {
                if (tokens.length === 0) {
                  logo.current_def = { to: to, name: name.value, args: args,
                    source: input, tokens: [] };
                  f(undefined, false);
                } else if (tokens.length === 1) {
                  f(logo.error(logo.ERR_DOESNT_LIKE, $show(tokens[0])));
                } else {
                  var thing = tokens.shift();
                  var word = tokens.shift();
                  if (!thing.is_procedure("THING")) {
                    f(logo.error(ERR_DOESNT_LIKE, $show(thing)));
                  } else if (!word.is_word()) {
                    f(logo.error(ERR_DOESNT_LIKE, $show(word)));
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

  // Create a procedure from its definition (name, arguments, source and tokens)
  logo.make_procedure = function(definition)
  {
    var p = function(tokens, f)
    {
      var scope = logo.scope;
      logo.scope = { current_procedure: logo.scope.current_procedure,
        things: Object.create(scope.things) };
      var n = definition.args.length;
      (function eval_args(i) {
        if (i < n) {
          logo.eval(tokens, function(error, value) {
              if (error) {
                f(error);
              } else {
                logo.scope.things[definition.args[i]] = value;
                eval_args(i + 1);
              }
            });
        } else {
          delete logo.scope.current_procedure;
          var exit = logo.scope.exit;
          logo.scope.exit = function(value) {
            logo.scope.exit = exit;
            f(undefined, value);
          };
          var tokens_ = definition.tokens.slice(0);
          logo.eval_loop(tokens_, function(error, value) {
              if (error) {
                f(error);
              } else if (tokens_.length !== 0) {
                f(logo.error(logo.ERR_INTERNAL,
                    "There should be no input left?!"));
              } else {
                f(undefined, value);
              }
            });
        }
      })(0);
    };
    p._source = definition.source;
    return p;
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
      } else {
        tokens.push(token);
      }
    }
    while (input.length > 0) {
      input = input.replace(/^\s+/, "");
      // console.log(tokens, " | ", input);
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
        push_token(logo.token(m[0]));
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
          push_token(logo.token(m[1], m[0]));
        } else if (m = input.match(/^((\d+(\.\d*)?)|(\d*\.\d+))/)) {
          push_token(logo.token(m[0], m[0]));
        } else if (m = input.match(/^(:?)([^\s\[\]\(\)+\-*\/=<>;]+)/)) {
          if (m[1] === ":") {
            push_token(logo.procedure("THING"));
            push_token(logo.token(m[2], m[0]));
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


  // A token is simply a wrapper around a value
  logo.$token =
  {
    butfirst: function() { return logo.token(this.value.substr(1)); },
    butlast: function()
      { return logo.token(this.value.substr(0, this.value.length - 1)); },
    toString: function() { return this.value; },
    is_datum: function() { return true; },
    is_false: function() { return /^false$/i.test(this.value); },
    is_list: function() { return false; },
    is_procedure: function(proc) { return false; },
    is_true: function() { return /^true$/i.test(this.value); },
    is_word: function() { return true; },
    item: function(i) { return logo.token(this.value.substr(i - 1, 1)); },
    show: function(surface) { return surface && this.surface || this.value; }
  };

  // Create a token (as a quoted thing or a return value from a function)
  logo.token = function(value, surface, proto)
  {
    var o = Object.create(proto || logo.$token);
    o.value = value;
    if (surface) o.surface = surface;
    return o;
  };

  // Simply return the value of the token, unless we're at the top execution
  // level in which case we don't know what to do with this value
  logo.$token.apply = function(tokens, f)
  {
    if (logo.scope.current_procedure) {
      f(undefined, this);
    } else {
      f(logo.error(logo.ERR_WHAT_TO_DO, $show(this)));
    }
  };

  // Test whether this word is equal to the given token, in the sense of EQUALP
  logo.$token.equalp = function(token)
  {
    return (this.is_number() && token.is_number() &&
        parseFloat(this.value) === parseFloat(token.value)) ||
      token.is_word() && this.value === token.value;
  };

  // Only lists can be evaluated in this context
  logo.$token.eval_tokens = function(f)
  {
    f(logo.error(logo.ERR_DOESNT_LIKE, $show(this)));
  };

  // Test whether this token's value is an integer
  logo.$token.is_integer = function(token)
  {
    return /^[-+]?\d+$/.test(this.value);
  };

  // Test whether this token's value is a number
  logo.$token.is_number = function(token)
  {
    return this.value !== "" && /^[+-]?\d*(\.\d*)?$/.test(this.value);
  };

  logo.$token.fput = function(thing)
  {
    if (thing.is_word() && thing.value.length === 1) {
      return logo.token(thing.value + this.value);
    } else {
      throw logo.error(logo.ERR_DOESNT_LIKE, $show(thing));
    }
  };

  logo.$token.lput = function(thing)
  {
    if (thing.is_word() && thing.value.length === 1) {
      return logo.token(this.value + thing.value);
    } else {
      throw logo.error(logo.ERR_DOESNT_LIKE, $show(thing));
    }
  };

  // A procedure invocation token
  logo.$procedure = Object.create(logo.$token);

  // Create a new procedure token with the given name
  logo.procedure = function(value, surface, proto)
  {
    return logo.token(value, surface, proto || logo.$procedure);
  };

  // Apply this procedure: consume the necessary tokens for evaluating the
  // arguments and call the continuation function with an error or a value on
  // success.
  logo.$procedure.apply = function(tokens, f)
  {
    var p = logo.procedures[this.value];
    if (typeof p === "function") {
      var q = logo.scope.current_procedure;
      logo.scope.current_procedure = this;
      p(tokens, function(error, value) {
          logo.scope.current_procedure = q;
          f(error, value);
        });
    } else {
      f(logo.error(logo.ERR_HOW_TO, $show(this)));
    }
  };

  logo.$procedure.is_false = function() { return false; };
  logo.$procedure.is_integer = function() { return false; };
  logo.$procedure.is_number = function() { return false; };
  logo.$procedure.is_true = function() { return false; };
  logo.$procedure.is_procedure = function(proc) { return this.value === proc; };


  // The list token has an array of tokens for values
  logo.$list = Object.create(logo.$token);

  // Create a list; if given a parameter (must be an array) then deep copy the
  // array and set it as the value
  logo.list = function(l, proto)
  {
    var copy = function(x) { return x instanceof Array ? x.map(copy) : x; };
    return logo.token(l ? l instanceof Array ? l.map(copy) : [l] : [],
        undefined, proto || logo.$list);
  };

  // Evaluate the list as a list of tokens
  // TODO check the current_procedure when evaluating the list
  logo.$list.eval_tokens = function(f)
  {
    try {
      var p = logo.scope.current_procedure;
      var list = this.value.map(function(x) { return x.show(); }).join(" ");
      var tokens = logo.tokenize(list);
      (function loop(val) {
        if (tokens.length === 0) {
          f(undefined, val);
        } else {
          $eval(tokens, loop);
        }
      })();
    } catch(e) {
      f(e);
    }
  };

  logo.$procedure.is_false = function() { return false; };
  logo.$list.is_list = function() { return true; };
  logo.$list.is_integer = function() { return false; };
  logo.$list.is_number = function() { return false; };
  logo.$procedure.is_true = function() { return false; };
  logo.$list.is_word = function() { return false; };
  logo.$list.item = function(i) { return this.value[i - 1] || logo.list(); },

  logo.$list.butfirst = function() { return logo.list(this.value.slice(1)); };

  logo.$list.butlast = function()
  {
    return logo.list(this.value.slice(0, this.value.length - 1));
  };

  logo.$list.equalp = function(token)
  {
    return (function deep_eq(x, y)
    {
      if (x.is_list() && y.is_list() && x.value.length === y.value.length) {
        for (var eq = true, i = 0, n = x.value.length; eq && i < n; ++i) {
          eq = deep_eq(x.value[i], y.value[i]);
        }
        return eq;
      } else {
        return x.is_word() && x.equalp(y);
      }
    })(this, token);
  };

  logo.$list.fput = function(t)
  {
    var list = this.value.slice(0);
    list.unshift(t);
    return logo.list(list);
  };

  logo.$list.lput = function(t)
  {
    var list = this.value.slice(0);
    list.push(t);
    return logo.list(list);
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
        return x.is_list() ? "[" + s + "]" : s;
      }).join(" ");
  };


  // A group is a meta token that contains a parenthesized group
  logo.$group = Object.create(logo.$list);

  logo.group = function(proto)
  {
    return logo.list(undefined, proto || logo.$group);
  }

  logo.$group.apply = function(tokens, f)
  {
    var tokens_ = this.value.slice(0);
    if (tokens_.length > 0) {
      var parens = !!logo.scope.in_parens;
      logo.scope.in_parens = true;
      logo.eval(tokens_, function(error, value) {
          logo.scope.in_parens = parens;
          if (error || tokens_.length === 0) {
            f(error, value);
          } else {
            f(logo.error(logo.ERR_TOO_MUCH_PARENS));
          }
        });
    } else {
      f(error, undefined);
    }
  };

  logo.$group.is_list = function() { return false; };

  logo.$group.show = function()
  {
    return "(" + this.value.map(function(x) { return x.show(); }).join(" ") +
      ")";
  }



  // Predefined procedures; from http://www.cs.berkeley.edu/~bh/usermanual

  // Helper function for a one-argument procedure. The function g must call the
  // continuation f itself.
  function $eval(tokens, g, f)
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
  function $eval_like(tokens, p, g, f)
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
  function $eval_bool(tokens, g, f)
  {
    $eval_like(tokens, function(t) { return t.is_true() || t.is_false(); },
        g, f);
  }

  function $eval_word(tokens, g, f)
  {
    $eval_like(tokens, function(t) { return t.is_word(); }, g, f);
  }

  function $eval_integer(tokens, g, f)
  {
    $eval_like(tokens, function(t) { return t.is_integer(); }, g, f);
  }

  // Eval a token, making sure that it is a list
  function $eval_list(tokens, g, f)
  {
    $eval_like(tokens, function(t) { return t.is_list(); }, g, f);
  }

  // Eval a token, making sure that it is a number
  function $eval_number(tokens, g, f)
  {
    $eval_like(tokens, function(t) { return t.is_number(); }, g, f);
  }

  // Wrapper around eval to slurp arguments within parens, or an expected
  // number of arguments. The function g gets called for each value with the
  // current accumulated value, initialized by init, and a continuation that it
  // must call on error or success with the new accumulated value.
  function $eval_slurp(tokens, g, f, n, init)
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
      $eval(tokens, function(list) {
          if (logo.scope.test !== p) {
            f();
          } else {
            list.eval_tokens(f);
          }
        }, f);
    }
  }

  // TODO ARRAY, MDARRAY, LISTTOARRAY, ARRAYTOLIST, REVERSE, GENSYM, FIRSTS,
  // BUTFIRSTS, MDITEM, PICK, REMOVE, REMDUP, QUOTED, SETITEM, MDSETITEM,
  // .SETFIRST, .SETBF, .SETITEM, PUSH, POP, QUEUE, DEQUEUE, ARRAY?, BEFORE?,
  // .EQ, SUBSTRING?, NUMBER?, BACKSLASHED?, ASCII, RAWASCII, CHAR, MEMBER,
  // LOWERCASE, UPPERCASE, STANDOUT, PARSE, RUNPARSE, TYPE, READWORD,
  // READRAWLINE, READCHAR, READCHARS, SHELL, SETPREFIX, PREFIX, OPENREAD,
  // OPENWRITE, OPENAPPEND, OPENUPDATE, CLOSE, ALLOPEN, CLOSEALL, ERASEFILE,
  // DRIBBLE, NODRIBBLE, SETREAD, SETWRITE, READER, WRITER, SETREADPOS,
  // SETWRITEPOS, READPOS, WRITEPOS, EOF?, FILE?, KEY?, CLEARTEXT, SETCURSOR,
  // CURSOR, SETMARGINS, SETTEXTCOLOR, INCREASEFONT, DECREASEFONT, SETTEXTSIZE,
  // TEXTSIZE, SETFONT, FONT, MODULO, INT, ROUND, SQRT, POWER, EXP, LOG10, LN,
  // SIN, RADSIN, COS, RADCOS, ARCTAN, RADARCTAN, ISEQ, RSEQ, LESS?, GREATER?,
  // LESSEQUAL?, GREATEREQUAL?, RANDOM, RERANDOM, FORM, BITAND, BITOR, BITXOR,
  // BITNOT, ASHIFT, LSHIFT, AND, OR, NOT, TO, DEFINE, TEXT, FULLTEXT, PROP,
  // GPROP, REMPROP, PLIST, PROCEDURE?, PRIMITIVE?, DEFINED?, NAME?, PLIST?,
  // CONTENTS, BURIED, TRACED, STEPPED, PROCEDURES, PRIMITIVES, NAMES, PLISTS,
  // NAMELIST, PLLIST, ARITY, NODES, POALL, POPS, PONS, POPLS, PON, POPL, POT,
  // POTS, ERASE, ERALL, ERPS, ERNS, ERPLS, ERN, ERPL, BURY, BURYALL, BURYNAME,
  // UNBURY, UNBURYALL, UNBURYNAME, BURIED?, TRACE, UNTRACE, TRACED?, STEP,
  // UNSTEP, STEPPED?, EDIT, EDITFILE, EDALL, EDPS, EDNS, EDPLS, EDN, EDPL,
  // SAVE, SAVEL, LOAD, CSLSLOAD, HELP, SETEDITOR, SETLIBLOC, SETHELPLOC,
  // SETCSLSLOC, SETTEMPLOC, GC, .SETSEGMENTSIZE, RUN, RUNRESULT, REPEAT,
  // FOREVER, REPCOUNT, CATCH, THROW, ERROR, PAUSE, CONTINUE, WAIT,
  // .MAYBEOUTPUT, GOTO, TAG, `, FOR, DO.WHILE, WHILE, DO.UNTIL, UNTIL, CASE,
  // COND, APPLY, INVOKE, FOREACH, MAP, MAP.SE, FILTER, FIND, REDUCE, CROSSMAP,
  // CASCADE, CASCADE.2, TRANSFER, .MACRO, MACRO?, MACROEXPAND
  logo.procedures = {

    // BUTFIRST wordorlist
    // BF wordorlist
    //   if the input is a word, outputs a word containing all but the first
    //   character of the input.  If the input is a list, outputs a list
    //   containing all but the first member of the input.
    BUTFIRST: function(tokens, f)
    {
      $eval(tokens, function(v) { f(undefined, v.butfirst()); }, f);
    },

    // BUTLAST wordorlist
    // BL wordorlist
    //   if the input is a word, outputs a word containing all but the last
    //   character of the input.  If the input is a list, outputs a list
    //   containing all but the last member of the input.
    BUTLAST: function(tokens, f)
    {
      $eval(tokens, function(v) { f(undefined, v.butlast()); }, f);
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
      $eval_word(tokens, function(newname) {
          var n = newname.value.toUpperCase();
          if (n in logo.procedures) {
            // TODO this should be an error only for primitives
            f(logo.error(logo.ERR_ALREADY_DEFINED, $show(newname)));
          } else {
            $eval_word(tokens, function(oldname) {
                var o = oldname.value.toUpperCase();
                var p = logo.procedures[o];
                if (!p) {
                  f(logo.error(logo.ERR_HOW_TO_FATAL, $show(oldname)));
                } else {
                  logo.procedures[n] = p;
                  f();
                }
              }, f);
          }
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
      $eval(tokens, function(v) { f(undefined, logo.token(v.value.length)); },
        f);
    },

    // DIFFERENCE num1 num2
    // TODO num1 - num2
    //   outputs the difference of its inputs.  Minus sign means infix
    //   difference in ambiguous contexts (when preceded by a complete
    //   expression), unless it is preceded by a space and followed
    //   by a nonspace.  (See also MINUS.)
    DIFFERENCE: function(tokens, f)
    {
      $eval_number(tokens, function(num1) {
          $eval_number(tokens, function(num2) {
              f(undefined,
                logo.token(parseFloat(num1.value) - parseFloat(num2.value)));
            }, f);
        }, f);
    },

    // EMPTYP thing
    // EMPTY? thing
    //   outputs TRUE if the input is the empty word or the empty list,
    //   FALSE otherwise.
    EMPTYP: function(tokens, f)
    {
      $eval(tokens, function(thing) {
          f(undefined, logo.bool(thing.value.length === 0))
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
      $eval(tokens, function(thing1) {
          $eval(tokens, function(thing2) {
              f(undefined, logo.bool(thing1.equalp(thing2)));
            }, f);
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
      $eval(tokens, function(thing) { f(undefined, thing.item(1)); }, f);
    },

    // FPUT thing list
    //   outputs a list equal to its second input with one extra member,
    //   the first input, at the beginning.  If the second input is a word,
    //   then the first input must be a one-letter word, and FPUT is
    //   equivalent to WORD.
    FPUT: function(tokens, f)
    {
      $eval(tokens, function(thing) {
          $eval(tokens, function(list) {
              f(undefined, list.fput(thing));
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
      $eval_bool(tokens, function(tf) {
          $eval_list(tokens, function(list_then) {
              if (logo.scope.in_parens && tokens.length > 0) {
                $eval_list(tokens, function(list_else) {
                    if (tf.is_true()) {
                      list_then.eval_tokens(f);
                    } else {
                      list_else.eval_tokens(f);
                    }
                  }, f);
              } else if (tf.is_true()) {
                list_then.eval_tokens(f);
              } else {
                f();
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
      $eval_bool(tokens, function(tf) {
          $eval_list(tokens, function(list_then) {
              $eval_list(tokens, function(list_else) {
                  if (tf.is_true()) {
                    list_then.eval_tokens(f);
                  } else {
                    list_else.eval_tokens(f);
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

    // ITEM index thing
	  //   if the "thing" is a word, outputs the "index"th character of the
    //   word.  If the "thing" is a list, outputs the "index"th member of
    //   the list.  If the "thing" is an array, outputs the "index"th
    //   member of the array.  "Index" starts at 1 for words and lists;
    //   the starting index of an array is specified when the array is created.
    //   TODO array
    ITEM: function(tokens, f)
    {
      $eval_integer(tokens, function(index) {
          $eval(tokens, function(thing) {
              f(undefined, thing.item(parseInt(index, 10)));
            }, f);
        }, f);
    },

    // LAST wordorlist
	  //   if the input is a word, outputs the last character of the word.
    //   If the input is a list, outputs the last member of the list.
    LAST: function(tokens, f)
    {
      $eval(tokens, function(v) { f(undefined, v.item(v.value.length)); }, f);
    },

    // LIST thing1 thing2
    // (LIST thing1 thing2 thing3 ...)
    //   outputs a list whose members are its inputs, which can be any
    //   Logo datum (word, list, or array).
    LIST: function(tokens, f)
    {
      $eval_slurp(tokens, function(v, list, g) {
          list.value.push(v);
          g(undefined, list);
        }, f, 2, logo.list());
    },

    // LISTP thing
    // LIST? thing
    //   outputs TRUE if the input is a list, FALSE otherwise.
    LISTP: function(tokens, f)
    {
      $eval(tokens, function(thing) {
          f(undefined, logo.bool(thing.is_list()));
        }, f);
    },

    // LPUT thing list
    //   outputs a list equal to its second input with one extra member,
    //   the first input, at the end.  If the second input is a word,
    //   then the first input must be a one-letter word, and LPUT is
    //   equivalent to WORD with its inputs in the other order.
    LPUT: function(tokens, f)
    {
      $eval(tokens, function(thing) {
          $eval(tokens, function(list) {
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
      $eval_word(tokens, function(varname) {
          var name = varname.value;
          $eval(tokens, function(value) {
              if (logo.scope.things.hasOwnProperty(name)) {
                logo.scope.things[name] = value;
              } else {
                logo.scope_global.things[name] = value;
              }
              f();
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
      $eval_number(tokens, function(num) {
          f(undefined, logo.token(-parseFloat(num.value)));
        }, f);
    },

    // NOTEQUALP thing1 thing2
    // NOTEQUAL? thing1 thing2
    // TODO thing1 <> thing2
    //   outputs FALSE if the inputs are equal, TRUE otherwise.  See EQUALP
    //   for the meaning of equality for different data types.
    NOTEQUALP: function(tokens, f)
    {
      $eval(tokens, function(thing1) {
          $eval(tokens, function(thing2) {
              f(undefined, logo.bool(!thing1.equalp(thing2)));
            }, f);
        }, f);
    },

    // OUTPUT value
    // OP value
	  //   command.  Ends the running of the procedure in which it appears.
    //   That procedure outputs the value "value" to the context in which
    //   it was invoked.  Don't be confused: OUTPUT itself is a command,
    //   but the procedure that invokes OUTPUT is an operation.
    OUTPUT: function(tokens, f)
    {
      $eval(tokens, function(value) { logo.scope.exit(value); }, f);
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
      $eval_slurp(tokens, function(v, _, g) {
          console.log(v.toString());
          g();
        }, f, 1);
    },

    // PRODUCT num1 num2
    // (PRODUCT num1 num2 num3 ...)
    // TODO num1 * num2
    //   outputs the product of its inputs.
    PRODUCT: function(tokens, f)
    {
      $eval_slurp(tokens, function(n, sum, g) {
          if (!n.is_number()) {
            g(logo.error(logo.ERR_DOESNT_LIKE, $show(n)));
          } else {
            g(undefined, logo.token(parseFloat(n.value) * sum));
          }
        }, f, 2, logo.token(1));
    },

    // PRINTOUT contentslist
    // PO contentslist
	  //   command.  Prints to the write stream the definitions of all
	  //    procedures, variables, and property lists named in the input
    //    contents list.
    PRINTOUT: function(tokens, f)
    {
      $eval_list(tokens, function(list) {
          var words = list.value.slice(0);
          (function po() {
            if (words.length === 0) {
              f();
            } else {
              var word = words.shift();
              if (!word.is_word()) {
                f(logo.error(logo.ERR_DOESNT_LIKE, $show(word)));
              } else {
                var p = logo.procedures[word.value.toUpperCase()];
                if (!p) {
                  f(logo.error(logo.ERR_DOESNT_LIKE, $show(word)));
                } else if (!p._source) {
                  f(logo.error(logo.ERR_IS_A_PRIMITIVE, $show(word)));
                } else {
                  console.log(p._source);
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
    //   TODO integers
    QUOTIENT: function(tokens, f)
    {
      if (logo.scope.in_parens) {
        $eval_number(tokens, function(num) {
            f(undefined, logo.token(1 / parseFloat(num.value)));
          }, f);
      } else {
        $eval_number(tokens, function(num1) {
            $eval_number(tokens, function(num2) {
                f(undefined, logo.token(parseFloat(num1.value) /
                    parseFloat(num2.value)))
              }, f);
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
            if (list.is_list()) {
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
      $eval_integer(tokens, function(num1) {
          var n1 = parseInt(num1, 10);
          var sign = n1 < 0 ? -1 : 1;
          $eval_integer(tokens, function(num2) {
              var n2 = parseInt(num2, 10);
              f(undefined, logo.token(sign * Math.abs(n1 % n2)));
            }, f);
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
      $eval_slurp(tokens, function(thing, sentence, g) {
          if (thing.is_list()) {
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
      $eval_slurp(tokens, function(v, _, g) {
          console.log($show(v));
          g();
        }, f, 1);
    },

    // STOP
	  //   command.  Ends the running of the procedure in which it appears.
    //   Control is returned to the context in which that procedure was
    //   invoked.  The stopped procedure does not output a value.
    STOP: function(tokens, f)
    {
      logo.scope.exit();
    },

    // SUM num1 num2
    // (SUM num1 num2 num3 ...)
    // TODO num1 + num2
    //   outputs the sum of its inputs.
    SUM: function(tokens, f)
    {
      $eval_slurp(tokens, function(n, sum, g) {
          if (!n.is_number()) {
            g(logo.error(logo.ERR_DOESNT_LIKE, $show(n)));
          } else {
            g(undefined, logo.token(parseFloat(n.value) + sum));
          }
        }, f, 2, logo.token(0));
    },

    // TEST tf
	  //   command.  Remembers its input, which must be TRUE or FALSE, for use
    //   by later IFTRUE or IFFALSE instructions.  The effect of TEST is local
    //   to the procedure in which it is used; any corresponding IFTRUE or
    //   IFFALSE must be in the same procedure or a subprocedure.
    TEST: function(tokens, f)
    {
      $eval(tokens, function(tf) {
          if (!(tf.is_true() || tf.is_false())) {
            f(logo.error(logo.ERR_DOESNT_LIKE, $show(tf)));
          } else {
            logo.scope.test = tf.is_true();
            f();
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
      $eval_word(tokens, function(varname) {
          var val = logo.scope.things[varname.value];
          if (val) {
            f(undefined, val);
          } else {
            f(logo.error(logo.ERR_NO_VAR, $show(varname)));
          }
        }, f);
    },

    // TO is handled in a special manner
    TO: function(tokens, f) { f(logo.error(logo.ERR_CANT_USE_HERE)); },

    // WORD word1 word2
    // (WORD word1 word2 word3 ...)
    //   outputs a word formed by concatenating its inputs.
    WORD: function(tokens, f)
    {
      $eval_slurp(tokens, function(v, w, g) {
          if (!v.is_word()) {
            g(logo.error(logo.ERR_DOESNT_LIKE, $show(v)));
          } else {
            g(undefined, logo.token(w.value + v.value));
          }
        }, f, 2, logo.token(""));
    },

    // WORDP thing
    // WORD? thing
    //   outputs TRUE if the input is a word, FALSE otherwise.
    WORDP: function(tokens, f)
    {
      $eval(tokens, function(thing) {
          f(undefined, logo.bool(thing.is_list()));
        }, f);
    },

  };

    /*

  logo.words =
  {

    // GLOBAL varname
    // GLOBAL varnamelist
    // (GLOBAL varname1 varname2 ...)
	  //   command.  Accepts as inputs one or more words, or a list of
    //   words.  A global variable is created for each of these words, with
    //   that word as its name.  The only reason this is necessary is that
    //   you might want to use the "setter" notation SETXYZ for a variable
    //   XYZ that does not already have a value; GLOBAL "XYZ makes that legal.
    //   Note: If there is currently a local variable of the same name, this
    //   command does *not* make Logo use the global value instead of the
    //   local one.
    GLOBAL: function(tokens)
    {
      logo.get_words(tokens).forEach(function(w) {
          if (!w in logo.scope_global.things) {
            logo.scope_global.things[w] = null;
          }
        });
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
    LOCAL: function(tokens)
    {
      logo.get_words(tokens).forEach(function(w) {
          logo.scope.things[w] = null;
        });
    },

    // MEMBERP thing1 thing2
    // MEMBER? thing1 thing2
    //   if "thing2" is a list or an array, outputs TRUE if "thing1" is EQUALP
    //   to a member of "thing2", FALSE otherwise.  If "thing2" is
    //   a word, outputs TRUE if "thing1" is a one-character word EQUALP to a
    //   character of "thing2", FALSE otherwise.
    MEMBERP: function(tokens)
    {
      var thing1 = logo.eval(tokens);
      return logo.bool(logo.eval(tokens).member_of(thing1));
    },

  };


  // Get a list of words; either all remaining tokens in a group, or the
  // members of the first token if a list, otherwise the first token itself
  function get_words(tokens)
  {
    var words = [];
    if (logo.scope.in_parens) {
      while (tokens.length > 0) words.push(logo.get_word(tokens));
    } else {
      var token = logo.eval(tokens);
      if (token.is_word()) {
        words.push(token);
      } else if (token.is_list()) {
        token.value.forEach(function(t) {
            if (!t.is_word()) {
              throw logo.error(4, t.show(true));
            }
            words.push(t);
          });
      }
    }
    if (words.length === 0) throw logo.error(6);
    return words;
  }

  */

}(typeof exports === "undefined" ? this.logo = {} : exports));
