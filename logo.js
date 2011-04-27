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

  logo.scope_global = logo.scope = { things: {} };

  // Helper functions to deal with the asynchronous calls

  // Use case: handles the error transparently; g is simply a function
  // called with the result of evaluating the first token and returning a value
  // in turn, which can be an error if something goes wrong. See BUTFIRST:
  //
  //   logo.eval(tokens, e(f, function(v) { return v.butfirst(); }));
  //
  function e(f, g)
  {
    return function(error, value, tokens) {
      if (error) {
        f(error);
      } else {
        var v = g(value);
        if (v && v.error_code) {
          f(v);
        } else {
          f(error, v, tokens);
        }
      }
    };
  }

  // Use case: handle errors getting the current token, otherwise leave the
  // inside function h (called with the token value) to call the f continuation
  // itself. A function that needs two inputs can be called by chaining g then
  // e, see FPUT:
  //
  //   logo.eval(tokens, g(f, function(thing) {
  //       logo.eval(tokens, e(f, function(list) {
  //           try { return list.fput(thing); } catch(e) { return e; }
  //         }));
  //     }));
  //
  function g(f, h)
  {
    return function(error, value, tokens) {
      if (error) {
        f(error);
      } else {
        h(value);
      }
    };
  }

  // Repeat the function h m times, or as many times as there are tokens in
  // parens, and return the accumulated value initialized with init.
  // The h function receives the current value (for the last token that was
  // evaluated) and the current accumulator (from the previously evaluated
  // tokens.) It updated the accumulator and returns an error if any.
  // Example: LIST
  //
  //   r(tokens, f, function(v, l) { l.value.push(v); }, 2, logo.list());
  //
  function r(tokens, f, h, m, init)
  {
    (function loop(n, acc) {
      if (n === 0) {
        f(undefined, acc, tokens);
      } else {
        logo.eval(tokens, g(f, function(value) {
            var error = h(value, acc);
            if (error) {
              f(error);
            } else {
              loop(n - 1, acc);
            }
          }));
      }
    })(logo.scope.in_parens ? tokens.length : m, init);
  }



  // Make an error object from the given error code and additional arguments.
  // The first argument is implied to be the current procedure (if any.) An
  // error object has a code and a message field.
  logo.error = function(code)
  {
    var msg = logo.error_messages[code] || "Unknown error ({0})".fmt(code);
    var args = Array.prototype.slice.call(arguments, 1);
    // Add the current word to the list of argument
    args.unshift(logo.scope.current_procedure ?
        logo.scope.current_procedure.show() : undefined);
    return { error_code: code, message: String.prototype.fmt.apply(msg, args) };
  };

  // Error messages; first argument is always the name of current work being
  // evaluted, other arguments are passed to the logo.error constructor
  logo.ERR_STACK_OVERFLOW = 2;
  logo.ERR_DOESNT_LIKE = 4;
  logo.ERR_NOT_ENOUGH_INPUT = 6;
  logo.ERR_TOO_MUCH_PARENS = 8;
  logo.ERR_WHAT_TO_DO = 9;
  logo.ERR_NO_VAR = 11;
  logo.ERR_UNEXPECTED_PAREN = 12;
  logo.ERR_HOW_TO = 13;
  logo.ERR_ALREADY_DEFINED = 15;
  logo.ERR_HOW_TO_FATAL = 24;
  logo.ERR_UNEXPECTED_BRACKET = 26;

  logo.error_messages = [];
  logo.error_messages[logo.ERR_STACK_OVERFLOW] = "Stack overflow";
  logo.error_messages[logo.ERR_DOESNT_LIKE] = "{0} doesn't like {1} as input";
  logo.error_messages[logo.ERR_NOT_ENOUGH_INPUT] = "Not enough inputs to {0}";
  logo.error_messages[logo.ERR_TOO_MUCH_PARENS] = "Too much inside ()'s";
  logo.error_messages[logo.ERR_NO_VAR] = "{1} has no value";
  logo.error_messages[logo.ERR_UNEXPECTED_PAREN] = "Unexpected \")\"";
  logo.error_messages[logo.ERR_WHAT_TO_DO] =
    "You don't say what to do with {1}";
  logo.error_messages[logo.ERR_HOW_TO] =
  logo.error_messages[logo.ERR_HOW_TO_FATAL] = "I don't know how to {1}";
  logo.error_messages[logo.ERR_ALREADY_DEFINED] = "{1} is already defined";
  logo.error_messages[logo.ERR_UNEXPECTED_BRACKET] = "Unexpected \"]\"";

  logo.error_messages[0] = "Fatal internal error ({1})";
  logo.error_messages[22] = "{1} is a primitive";
  logo.error_messages[23] = "Can't use {0} here";
  logo.error_messages[25] = "{0} without test";
  logo.error_messages[30] = logo.error_messages[9];

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
      console.log("eval_loop", tokens);
      logo.eval(tokens, function(error, value, tokens) {
          if (error) {
            f(error);
          } else {
            console.log("eval_loop: latest value is", value);
            logo.eval_loop(tokens, f, value);
          }
        });
    } else {
      console.log("eval_loop: no more tokens, returning:", value);
      f(undefined, value, tokens);
    }
  };

  // Evaluate one line of input, and call the continuation with the appropriate
  // mode (eval or define) for the next line of input
  logo.eval_input = function(input, f)
  {
    logo.scope = logo.scope_global;
    try {
      var tokens = logo.tokenize(input);
      if (tokens.length > 0 && tokens[0].is_procedure("TO")) {
        if (logo.current_def) {
          f(logo.error(ERR_INTERNAL, "Shouldn't be in eval mode here?!"));
        } else {
          var lines = [tokens.slice(0)];
          logo.scope.current_procedure = tokens.shift();
          if (tokens.length > 0) {
            // Read the name of the procedure
            var name = tokens.shift();
            if (!name.is_word()) {
              f(logo.error(logo.ERR_DOESNT_LIKE, name.show()));
            } else if (name in logo.procedures) {
              f(logo.error(logo.ERR_ALREADY_DEFINED, name.show()));
            } else {
              // Read args: they are pairs of THING followed by a word
              var args = [];
              (function read_var() {
                if (tokens.length === 0) {
                  logo.current_def = { name: name.value, args: args,
                    lines: lines };
                  f(undefined, false, []);
                } else if (tokens.length === 1) {
                  f(logo.error(logo.ERR_DOESNT_LIKE, tokens[0].show()));
                } else {
                  var thing = tokens.shift();
                  var word = tokens.shift();
                  if (!thing.is_procedure("THING")) {
                    f(logo.error(ERR_DOESNT_LIKE, thing.show()));
                  } else if (!word.is_word()) {
                    f(logo.error(ERR_DOESNT_LIKE, word.show()));
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
        logo.eval_loop(tokens, function(error, value, tokens) {
            if (error) {
              f(error);
            } else if (tokens.length !== 0) {
              f(logo.error(ERR_INTERNAL, "There should be no input left?!"));
            } else {
              f(undefined, true, []);
            }
          });
      }
    } catch (error) {
      f(error);
    }
  };

  // Create a procedure from its definition (name, arguments and lines)
  logo.make_procedure = function(definition)
  {
    var name = definition.name;
    var args = definition.args;
    var lines = definition.lines;
    var p = function(tokens, f)
    {
      console.log(">>>", name, args);
      var scope = logo.scope;
      logo.scope = { current_procedure: lines[0][1],
        things: Object.create(scope.things) };
      var n = args.length;
      console.log("=== eval args ({0})".fmt(n));
      (function eval_args(i) {
        if (i < n) {
          console.log("=== eval arg#{0} ({1})".fmt(i, args[i]));
          logo.eval(tokens, e(f, function(value) {
              logo.scope.things[args[i]] = value;
              console.log("=== eval arg#{0} ({1}) = {2}"
                .fmt(i, args[i], value.show()), value);
              eval_args(i + 1);
            }));
        } else {
          console.log("*** Done with args, now body");
          var m = lines.length - 1;
          (function eval_lines(j, val) {
            if (j < m) {
              var tokens_ = lines[j].slice(0);
              console.log("*** Line #{0}/{1}: ".fmt(j, m - 1), tokens_);
              (function eval_tokens() {
                if (tokens_.length > 0) {
                  logo.eval(tokens_, function(error, value, tokens) {
                      
                    });
                }
              })();
            } else {
              console.log("<<< Done, returning {0}".fmt(val ? val.show() : val))
              logo.scope = scope;
              f(undefined, val, tokens);
            }
          })(1);
        }
      })(0);
    };
    p._name = name;
    p._args = args;
    p._lines = lines;
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
      logo.current_def.lines.push(tokens);
      if (tokens.length === 1 && tokens[0].is_procedure("END")) {
        // End function definition mode
        logo.procedures[logo.current_def.name] =
          logo.make_procedure(logo.current_def);
        logo.current_def = null;
        f(undefined, true, []);
      } else {
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
    show: function() { return this.surface || this.value; }
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
      f(undefined, this, tokens);
    } else {
      f(logo.error(logo.ERR_WHAT_TO_DO, this.show()));
    }
  };

  logo.$token.fput = function(thing)
  {
    if (thing.is_word() && thing.value.length === 1) {
      return logo.token(thing.value + this.value);
    } else {
      throw logo.error(logo.ERR_DOESNT_LIKE, thing.show());
    }
  };

  logo.$token.lput = function(thing)
  {
    if (thing.is_word() && thing.value.length === 1) {
      return logo.token(this.value + thing.value);
    } else {
      throw logo.error(logo.ERR_DOESNT_LIKE, thing.show());
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
      p(tokens, function(error, value, tokens) {
          logo.scope.current_procedure = q;
          f(error, value, tokens);
        });
    } else {
      f(logo.error(logo.ERR_HOW_TO, this.show()));
    }
  };

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

  logo.$list.is_list = function() { return true; };
  logo.$list.is_word = function() { return false; };
  logo.$list.item = function(i) { return this.value[i - 1] || logo.list(); },

  logo.$list.butfirst = function() { return logo.list(this.value.slice(1)); };

  logo.$list.butlast = function()
  {
    return logo.list(this.value.slice(0, this.value.length - 1));
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
      logo.eval(tokens_, function(error, value, tokens__) {
          logo.scope.in_parens = parens;
          if (error || tokens__.length === 0) {
            f(error, value, tokens);
          } else {
            f(logo.error(logo.ERR_TOO_MUCH_PARENS));
          }
        });
    } else {
      f(error, undefined, tokens);
    }
  };

  logo.$group.is_list = function() { return false; };

  logo.$group.show = function()
  {
    return "(" + this.value.map(function(x) { return x.show(); }).join(" ") +
      ")";
  }



  // Predefined procedures; from http://www.cs.berkeley.edu/~bh/usermanual

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
  // BITNOT, ASHIFT, LSHIFT, AND, OR, NOT, TO, DEFINE, TEXT, FULLTEXT, COPYDEF,
  // PROP, GPROP, REMPROP, PLIST, PROCEDURE?, PRIMITIVE?, DEFINED?, NAME?,
  // PLIST?, CONTENTS, BURIED, TRACED, STEPPED, PROCEDURES, PRIMITIVES, NAMES,
  // PLISTS, NAMELIST, PLLIST, ARITY, NODES, POALL, POPS, PONS, POPLS, PON,
  // POPL, POT, POTS, ERASE, ERALL, ERPS, ERNS, ERPLS, ERN, ERPL, BURY,
  // BURYALL, BURYNAME, UNBURY, UNBURYALL, UNBURYNAME, BURIED?, TRACE, UNTRACE,
  // TRACED?, STEP, UNSTEP, STEPPED?, EDIT, EDITFILE, EDALL, EDPS, EDNS, EDPLS,
  // EDN, EDPL, SAVE, SAVEL, LOAD, CSLSLOAD, HELP, SETEDITOR, SETLIBLOC,
  // SETHELPLOC, SETCSLSLOC, SETTEMPLOC, GC, .SETSEGMENTSIZE, RUN, RUNRESULT,
  // REPEAT, FOREVER, REPCOUNT, STOP, OUTPUT, CATCH, THROW, ERROR, PAUSE,
  // CONTINUE, WAIT, .MAYBEOUTPUT, GOTO, TAG, `, FOR, DO.WHILE, WHILE,
  // DO.UNTIL, UNTIL, CASE, COND, APPLY, INVOKE, FOREACH, MAP, MAP.SE, FILTER,
  // FIND, REDUCE, CROSSMAP, CASCADE, CASCADE.2, TRANSFER, .MACRO, MACRO?,
  // MACROEXPAND
  logo.procedures = {

    // BUTFIRST wordorlist
    // BF wordorlist
    //   if the input is a word, outputs a word containing all but the first
    //   character of the input.  If the input is a list, outputs a list
    //   containing all but the first member of the input.
    BUTFIRST: function(tokens, f)
    {
      logo.eval(tokens, e(f, function(v) { return v.butfirst(); }));
    },

    // BUTLAST wordorlist
    // BL wordorlist
    //   if the input is a word, outputs a word containing all but the last
    //   character of the input.  If the input is a list, outputs a list
    //   containing all but the last member of the input.
    BUTLAST: function(tokens, f)
    {
      logo.eval(tokens, e(f, function(v) { return v.butlast(); }));
    },

    // COUNT thing
    //   outputs the number of characters in the input, if the input is a word;
    //   outputs the number of members in the input, if it is a list or an
    //   array.  (For an array, this may or may not be the index of the
    //   last member, depending on the array's origin.)
    //   TODO arrays
    COUNT: function(tokens, f)
    {
      logo.eval(tokens, e(f,
            function(v) { return logo.token(v.value.length); }));
    },

    // FIRST thing
	  //   if the input is a word, outputs the first character of the word.
    //   If the input is a list, outputs the first member of the list.
    //   If the input is an array, outputs the origin of the array (that is,
    //   the INDEX OF the first member of the array).
    //   TODO arrays
    FIRST: function(tokens, f)
    {
      logo.eval(tokens, e(f, function(v) { return v.item(1); }));
    },

    // FPUT thing list
    //   outputs a list equal to its second input with one extra member,
    //   the first input, at the beginning.  If the second input is a word,
    //   then the first input must be a one-letter word, and FPUT is
    //   equivalent to WORD.
    FPUT: function(tokens, f)
    {
      logo.eval(tokens, g(f, function(thing) {
          logo.eval(tokens, e(f, function(list) {
              try {
                return list.fput(thing);
              } catch(e) {
                return e;
              }
            }));
        }));
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
      logo.eval(tokens, g(f, function(index) {
          logo.eval(tokens, e(f, function(thing) {
              var i = parseInt(index, 10);
              return isNaN(i) ?
                logo.error(logo.ERR_DOESNT_LIKE, index.show()) :
                thing.item(i);
            }));
        }));
    },

    // LAST wordorlist
	  //   if the input is a word, outputs the last character of the word.
    //   If the input is a list, outputs the last member of the list.
    LAST: function(tokens, f)
    {
      logo.eval(tokens, e(f, function(v) { return v.item(v.value.length); }));
    },

    // LIST thing1 thing2
    // (LIST thing1 thing2 thing3 ...)
    //   outputs a list whose members are its inputs, which can be any
    //   Logo datum (word, list, or array).
    LIST: function(tokens, f)
    {
      r(tokens, f, function(v, l) { l.value.push(v); }, 2, logo.list());
    },

    // LPUT thing list
    //   outputs a list equal to its second input with one extra member,
    //   the first input, at the end.  If the second input is a word,
    //   then the first input must be a one-letter word, and LPUT is
    //   equivalent to WORD with its inputs in the other order.
    LPUT: function(tokens, f)
    {
      logo.eval(tokens, g(f, function(thing) {
          logo.eval(tokens, e(f, function(list) {
              try {
                return list.lput(thing);
              } catch(e) {
                return e;
              }
            }));
        }));
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
      r(tokens, f, function(value) { console.log(value.toString()); }, 1);
    },

    // PRODUCT num1 num2
    // (PRODUCT num1 num2 num3 ...)
    // TODO num1 * num2
    //   outputs the product of its inputs.
    PRODUCT: function(tokens, f)
    {
      r(tokens, f, function(v, p) {
          var n = parseFloat(v.value);
          if (isNaN(n)) return logo.error(logo.ERR_DOESNT_LIKE, v.show());
            p.value *= parseFloat(v.value);
          }, 2, logo.token(1));
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
          var list = logo.tokenize("[" + input + "]")[0];
          if (list.is_list()) {
            f(undefined, list, tokens);
          } else {
            f(logo.error(ERR_INTERNAL,
                  "{1} is not a list?!".fmt(list.show())));
          }
        });
    },

    // SENTENCE thing1 thing2
    // SE thing1 thing2
    // (SENTENCE thing1 thing2 thing3 ...)
    // (SE thing1 thing2 thing3 ...)
    //   outputs a list whose members are its inputs, if those inputs are
    //   not lists, or the members of its inputs, if those inputs are lists.
    SENTENCE: function(tokens, f)
    {
      r(tokens, f, function(v, l) {
          if (v.is_list()) {
            l.value = l.value.concat(v.value);
          } else {
            l.value.push(v);
          }
        }, 2, logo.list());
    },

    // SHOW thing
    // (SHOW thing1 thing2 ...)
    //   command.  Prints the input or inputs like PRINT, except that
    //   if an input is a list it is printed inside square brackets.
    SHOW: function(tokens, f)
    {
      r(tokens, f, function(value) { console.log(value.show()); }, 1);
    },

    // SUM num1 num2
    // (SUM num1 num2 num3 ...)
    // TODO num1 + num2
    //   outputs the sum of its inputs.
    SUM: function(tokens, f)
    {
      r(tokens, f, function(v, s) {
          var n = parseFloat(v.value);
          if (isNaN(n)) return logo.error(logo.ERR_DOESNT_LIKE, v.show());
          s.value += parseFloat(v.value);
        }, 2, logo.token(0));
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
      logo.eval(tokens, g(f, function(varname) {
          if (!varname.is_word()) {
            return logo.error(logo.ERR_DOESNT_LIKE, varname.show());
          } else {
            var value = varname.value in logo.scope.things ?
              logo.scope.things[varname.value] : undefined;
            console.log("THING {0} =".fmt(varname.value), value);
            return value || logo.error(logo.ERR_NO_VAR, varname.show());
          }
        }));
    },

    // WORD word1 word2
    // (WORD word1 word2 word3 ...)
    //   outputs a word formed by concatenating its inputs.
    WORD: function(tokens, f)
    {
      r(tokens, f, function(v, w) {
          if (!v.is_word()) {
            return logo.error(logo.ERR_DOESNT_LIKE, v.show());
          }
          w.value += v.value;
        }, 2, logo.token(""));
    },

  };

    /*

  logo.words =
  {

    // DIFFERENCE num1 num2
    // TODO num1 - num2
    //   outputs the difference of its inputs.  Minus sign means infix
    //   difference in ambiguous contexts (when preceded by a complete
    //   expression), unless it is preceded by a space and followed
    //   by a nonspace.  (See also MINUS.)
    DIFFERENCE: function(tokens)
    {
      return logo
        .token(logo.get_num(tokens) - logo.get_num(tokens));
    },

    // EMPTYP thing
    // EMPTY? thing
    //   outputs TRUE if the input is the empty word or the empty list,
    //   FALSE otherwise.
    EMPTYP: function(tokens)
    {
      return logo.bool(logo.eval(tokens).value.length === 0);
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
    EQUALP: function(tokens)
    {
      return logo.bool(logo.eval(tokens).equalp(logo.eval(tokens)));
    },

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

    // IF tf instructionlist
    // TODO (IF tf instructionlist1 instructionlist2)
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
    IF: function(tokens) { return ifelse(tokens, false); },

    // IFELSE tf instructionlist1 instructionlist2
    //   command or operation.  If the first input has the value TRUE, then
    //   IFELSE runs the second input.  If the first input has the value FALSE,
    //   then IFELSE runs the third input.  IFELSE outputs a value if the
    //   instructionlist contains an expression that outputs a value.
    IFELSE: function(tokens) { return ifelse(tokens, true); },

    // IFFALSE instructionlist
    // IFF instructionlist
	  //   command.  Runs its input if the most recent TEST instruction had
    //   a FALSE input.  The TEST must have been in the same procedure or a
    //   superprocedure.
    IFFALSE: function(tokens) { if_true_false(tokens, false); },

    // IFTRUE instructionlist
    // IFT instructionlist
	  //   command.  Runs its input if the most recent TEST instruction had
    //   a TRUE input.  The TEST must have been in the same procedure or a
    //   superprocedure.
    IFTRUE: function(tokens) { if_true_false(tokens, true); },

    // LISTP thing
    // LIST? thing
    //   outputs TRUE if the input is a list, FALSE otherwise.
    LISTP: function(tokens) { return logo.bool(logo.eval(tokens).is_list()); },

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

    // MAKE varname value
    //   command.  Assigns the value "value" to the variable named "varname",
    //   which must be a word.  Variable names are case-insensitive.  If a
    //   variable with the same name already exists, the value of that
    //   variable is changed.  If not, a new global variable is created.
    MAKE: function(tokens)
    {
      var varname = logo.get_word(tokens);
      var value = logo.eval(tokens);
      if (logo.scope.things.hasOwnProperty(varname)) {
        logo.scope.things[varname] = value;
      } else {
        logo.scope_global.things[varname] = value;
      }
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

    // MINUS num
    // TODO - num
    //   outputs the negative of its input.  Minus sign means unary minus if
    //   the previous token is an infix operator or open parenthesis, or it is
    //   preceded by a space and followed by a nonspace.  There is a difference
    //   in binding strength between the two forms:
    //     MINUS 3 + 4	means	-(3+4)
    //     - 3 + 4		means	(-3)+4
    MINUS: function(tokens)
    {
      return logo.token(-logo.get_num(tokens));
    },

    // NOTEQUALP thing1 thing2
    // NOTEQUAL? thing1 thing2
    // TODO thing1 <> thing2
    //   outputs FALSE if the inputs are equal, TRUE otherwise.  See EQUALP
    //   for the meaning of equality for different data types.
    NOTEQUALP: function(tokens)
    {
      return logo.bool(!logo.eval(tokens).equalp(logo.eval(tokens)));
    },

    // PRINTOUT contentslist
    // PO contentslist
	  //   command.  Prints to the write stream the definitions of all
	  //    procedures, variables, and property lists named in the input
    //    contents list.
    PRINTOUT: function(tokens)
    {
      var what = logo.eval(tokens);
      function print_f(token)
      {
        var f = logo.words[token.value.toUpperCase()];
        if (f && f._name) {
          f._lines.forEach(function(x) {
              console.log(x.filter(function(t) {
                  return t.surface || !t.eq_word("THING");
                }).map(function(t) { return t.show(true); }).join(" "));
            });
        } else if (f) {
          throw logo.error(22, token.show(true));
        } else {
          throw "Could not find a function named \"{0}\"".fmt(token.value);
        }
      }
      if (what.is_word()) {
        print_f(what);
      } else {
        what.value.forEach(print_f);
      }
    },

    // QUOTIENT num1 num2
    // (QUOTIENT num)
    // TODO num1 / num2
    //   outputs the quotient of its inputs.  The quotient of two integers
    //   is an integer if and only if the dividend is a multiple of the divisor.
    //   (In other words, QUOTIENT 5 2 is 2.5, not 2, but QUOTIENT 4 2 is
    //   2, not 2.0 -- it does the right thing.)  With a single input,
    //   QUOTIENT outputs the reciprocal of the input.
    QUOTIENT: function(tokens)
    {
      var op1 = logo.scope.in_parens && tokens.length === 1 ?
        1 : logo.get_num(tokens);
      var op2 = logo.get_num(tokens);
      return logo.token(op1 / op2);
    },

    // REMAINDER num1 num2
    //   outputs the remainder on dividing "num1" by "num2"; both must be
    //   integers and the result is an integer with the same sign as num1.
    REMAINDER: function(tokens)
    {
      var num1 = logo.get_int(tokens);
      var sign = num1 < 0 ? -1 : 1;
      return logo
        .token((Math.abs(num1) % Math.abs(logo.get_int(tokens))) * sign);
    },

    // TEST tf
	  //   command.  Remembers its input, which must be TRUE or FALSE, for use
    //   by later IFTRUE or IFFALSE instructions.  The effect of TEST is local
    //   to the procedure in which it is used; any corresponding IFTRUE or
    //   IFFALSE must be in the same procedure or a subprocedure.
    TEST: function(tokens)
    {
      logo.scope.test = logo.get_bool(tokens);
    },

    // TO is handled in a special manner
    TO: function(tokens) { throw logo.error(23); },

    // WORDP thing
    // WORD? thing
    //   outputs TRUE if the input is a word, FALSE otherwise.
    WORDP: function(tokens) { return logo.bool(logo.eval(tokens).is_word()); },
  };

  // Abbrevs
  logo.words.BF = logo.words.BUTFIRST;
  logo.words.BL = logo.words.BUTLAST;
  logo.words.IFF = logo.words.IFFALSE;
  logo.words.IFT = logo.words.IFTRUE;
  logo.words.PO = logo.words.PRINTOUT;
  logo.words.PR = logo.words.PRINT;
  logo.words.RL = logo.words.READLIST;
  logo.words.SE = logo.words.SENTENCE;
  logo.words["EMPTY?"] = logo.words.EMPTYP;
  logo.words["EQUAL?"] = logo.words.EQUALP;
  logo.words["LIST?"] = logo.words.LISTP;
  logo.words["MEMBER?"] = logo.words.MEMBERP;
  logo.words["NOTEQUAL?"] = logo.words.NOTEQUALP;
  logo.words["WORD?"] = logo.words.WORDP;


  // Helper functions for if/ifelse
  var eval_list = function(list)
  {
    var tokens_ = logo.tokenize(list.toString());
    var val;
    while (tokens_.length > 0) val = logo.eval(tokens_);
    return val;
  };

  // if and ifelse
  function ifelse(tokens, has_else)
  {
    var p = logo.get_bool(tokens);
    var then = logo.get_list(tokens);
    var else_ = has_else || (tokens.length > 0 && tokens[0].is_list()) ?
      logo.get_list(tokens) : undefined;
    return p ? eval_list(then) : else_ ? eval_list(else_) : undefined;
  }

  // iftrue and iffalse
  function if_true_false(tokens, p)
  {
    if (typeof logo.scope.test !== "boolean") throw logo.error(25);
    var then = logo.get_list(tokens);
    if (logo.scope.test === p) eval_list(then);
  }

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


  // Get all but the first characters of the value of the token
  logo.$token.butfirst = function()
  {
    return logo.token(this.value.substr(1));
  };

  // Get all but the last character of the value of the token
  logo.$token.butlast = function()
  {
    return logo.token(this.value.substr(0, this.value.length - 1));
  };

  // Test whether this word is equal to the given token, in the sense of EQUALP
  logo.$token.equalp = function(token)
  {
    return (this.is_number() && token.is_number() &&
        parseFloat(this.value) === parseFloat(token.value)) ||
      token.is_word() && this.value === token.value;
  };

  // Test whether this token's value is a number
  logo.$token.is_number = function(token)
  {
    return this.value !== "" && /^\d*(\.\d*)?$/.test(this.value);
  };

  // Get the ith item (as a general rule, the ith character; first index is 1)
  logo.$token.item = function(i)
  {
    return logo.token(this.value.substr(i - 1, 1));
  };

  // TODO
  logo.$token.member_of = function(token)
  {
    return false;
  }

  logo.$list.equalp = function(token)
  {
    function deep_eq(x, y)
    {
      if (x.is_list() && y.is_list() && x.value.length === y.value.length) {
        for (var eq = true, i = 0, n = x.value.length; eq && i < n; ++i) {
          eq = deep_eq(x.value[i], y.value[i]);
        }
        return eq;
      } else {
        return x.is_word() && x.equalp(y);
      }
    }
    return deep_eq(this, token);
  };

  logo.$list.is_false = function() { return false; };
  logo.$list.is_list = function() { return true; };
  logo.$list.is_true = function() { return false; };
  logo.$list.is_number = function() { return false; };
  logo.$list.is_word = function() { return false; };

  // Get the ith item of the list; an empty list if out of bounds
  logo.$list.item = function(i)
  {
    var v = this.value[i - 1];
    return v ? v : logo.token("");
  };

  logo.$list.butfirst = function()
  {
    var list = logo.list(this.value);
    list.value.shift();
    return list;
  };

  logo.$list.butlast = function()
  {
    var list = logo.list(this.value);
    list.value.pop();
    return list;
  };


  // Test whether this is the same as the given word
  // TODO test for shortcuts
  logo.$word.eq_word = function(w) { return this.value === w; };

  logo.$word.is_datum = function() { return false; };
  logo.$word.is_number = function() { return false; };


  // Create a token with the value TRUE or FALSE depending on the predicate p
  logo.bool = function(p)
  {
    return logo.token(p ? "TRUE" : "FALSE");
  }

  // Get a boolean value
  logo.get_bool = function(tokens)
  {
    var token = logo.eval(tokens);
    if (token.is_true()) {
      return true;
    } else if (token.is_false()) {
      return false;
    } else {
      throw logo.error(4, token.show(true));
    }
  };

  // Get a token that evaluates to an integer
  logo.get_int = function(tokens)
  {
    var token = logo.eval(tokens);
    var n = parseInt(token.value, 10);
    if (isNaN(n)) {
      throw logo.error(4, token.show(true));
    }
    return n;
  };

  // Get a list token
  logo.get_list = function(tokens)
  {
    var token = logo.eval(tokens);
    if (!token.is_list()) {
      throw logo.error(4, token.show(true));
    }
    return token;
  };

  // Get a token that evaluates to a number
  logo.get_num = function(tokens)
  {
    var token = logo.eval(tokens);
    var n = parseFloat(token.value);
    if (isNaN(n)) {
      throw logo.error(4, token.show(true));
    }
    return n;
  };

  // Get a word token
  logo.get_word = function(tokens)
  {
    var token = logo.eval(tokens);
    if (!token.is_word()) {
      throw logo.error(4, token.show(true));
    }
    return token.value;
  };

  logo.current_def = null;

  */

}(typeof exports === "undefined" ? this.logo = {} : exports));
