// The main interpreter/library
// TODO
//   * groups/infix bugs (e.g. print (2+3)/(2*3))
//   * improve GUI
//   * |(| ?

if (typeof exports === "object") populus = require("populus");

// Functions in the logo namespace, or exported to a logo module if used with
// node.js
(function(logo) {

  logo.PROMPT_EVAL = "? ";        // normal eval prompt
  logo.PROMPT_DEFINE = "> ";      // function definition
  logo.PROMPT_CONTINUE = "~ ";    // continue (after ~ or inside brackets)
  logo.PROMPT_BACKSLASH = "\\ ";  // continue (after \)
  logo.PROMPT_READ = "";          // no prompt for READLIST, READWORD, etc.

  // Prompt for a line, handling the ~ character
  // The REPL needs to define prompt_raw, which prompts for a single line and
  // returns the raw version.
  logo.prompt = function(p, f)
  {
    logo.prompt_raw(p, function(line) {
      var m = line.match(/(^|[^\\])(\\\\)*~$/);
      if (m) {
        line = line.replace(/((?:^|[^\\])(?:\\\\)*)(;.*)?~$/, "$1");
        logo.prompt(logo.PROMPT_CONTINUE, function(line_) { f(line + line_); });
      } else {
        f(line);
      }
    });
  };

  // Request a complete line of input (managing lines broken up by ~, \ or
  // newlines inside brackets) from the REPL, tokenize it and evaluate it.
  logo.eval_line = function(f)
  {
    logo.scope = logo.scope_global;
    logo.scope.exit = f;
    logo.prompt(logo.PROMPT_EVAL,
        function(input) { logo.eval_input(input, f); });
  };

  // Eval an already obtained line of input
  logo.eval_input = function(input, f)
  {
    logo.tokenize(input, function(error, tokens) {
        if (error) {
          f(error);
        } else if (tokens.length > 0 && (tokens[0].is_procedure("TO") ||
            tokens[0].is_procedure(".MACRO"))) {
          logo.read_procedure_definition(tokens, input, f);
        } else {
          logo.eval_regular_line(tokens, f);
        }
      });
  };

  // Tokenize an input string
  logo.tokenize = function(input, f, state)
  {
    logo.trace("Tokenizing \"{0}\" ({1})".fmt(input, state ? state.id : ""));
    if (!state) {
      state = {
        tokens: [],
        id: populus.random_id(6),
        push_token: function(token)
        {
          if (this.current_list) {
            this.current_list.value.push(token);
          } else if (this.current_group) {
            this.current_group.value.push(token);
            if (this.current_group.value.length === 1) token.in_parens = true;
          } else {
            this.tokens.push(token);
          }
        }
      };
    }
    var m;
    input = input.replace(/^\s+/, "");
    if (input.length > 0) {
      if (m = input.match(/^\\$/)) {
        logo.prompt(logo.PROMPT_BACKSLASH,
          function(line) { logo.tokenize(line, f, state); });
      } else {
        if (m = input.match(/^;([^\\]|\\.)*/)) {
          // comment, just skip
        } else if (m = input.match(/^\[/)) {
          var l = logo.list.$new();
          l.parent = state.current_list;
          state.push_token(l);
          state.current_list = l;
        } else if (m = input.match(/^\]/)) {
          if (state.current_list) {
            state.current_list = state.current_list.parent;
          } else {
            state.push_token(logo.error.$new("UNEXPECTED_BRACKET"));
          }
        } else if (state.current_list) {
          m = input.match(/^([^\s\[\]\\]|(\\.))+/);
          state.push_token(logo.new_word(m[0].replace(/\\(.)/g, "$1", m[0])));
        } else if (m = input.match(/^\(/)) {
          var g = logo.group.$new();
          g.parent = state.current_group;
          state.push_token(g);
          state.current_group = g;
        } else if (m = input.match(/^\)/)) {
          if (state.current_group) {
            state.current_group = state.current_group.parent;
          } else {
            state.push_token(logo.error.$new("UNEXPECTED_PAREN"));
          }
        } else {
          if (m = input.match(/^"((?:[^\s\[\]\(\);\\]|(?:\\.))*)/)) {
            state.push_token(logo.new_word(m[1].replace(/\\(.)/g, "$1"), m[0]));
          } else if (m = input
              .match(/^((\d+(\.\d*)?)|(\d*\.\d+))(?=[\s\[\]\(\)+\-*\/=<>;]|$)/))
          {
            state.push_token(logo.new_word(m[0], m[0]));
          } else if (m = input.match(/^\?(\d+)(?=[\s\[\]\(\)+\-*\/=<>;]|$)/)) {
            var group = logo.group.$new();
            var q = logo.procedure.$new("?");
            q.in_parens = true;
            group.value.push(q);
            group.value.push(logo.new_word(m[1]));
            state.push_token(group);
          } else if (m = input
              .match(/^(:?)((?:[^\s\[\]\(\)+\-*\/=<>;\\]|(?:\\.))+)/)) {
            if (m[1] === ":") {
              var group = logo.group.$new();
              var thing = logo.procedure.$new("THING");
              thing.in_parens = true;
              group.value.push(thing);
              group.value.push(logo.new_word(m[2].replace(/\\(.)/g, "$1"),
                    m[0]));
              logo.trace("THING: {{0}}".fmt(group.show()));
              state.push_token(group);
            } else {
              state.push_token(logo.procedure
                  .$new(m[0].replace(/\\(.)/g, "$1").toUpperCase(), m[0]));
            }
          } else if (m = input.match(/^(<=|>=|<>|=|<|>)/)) {
            state.push_token(logo.infix.$new(m[0], m[0], 1));
          } else if (m = input.match(/^(\+|\-)/)) {
            state.push_token(logo.infix.$new(m[0], m[0], 2));
          } else if (m = input.match(/^(\*|\/)/)) {
            state.push_token(logo.infix.$new(m[0], m[0], 3));
          } else if (m = input.match(/./)) {
            state.push_token(logo.new_word(m[0]));
          }
        }
        if (m) {
          logo.tokenize(input.substring(m[0].length), f, state);
        } else {
          f(logo.error.$new("UNEXPECTED_INPUT", input));
        }
      }
    } else if (state.current_group || state.current_list) {
      logo.prompt(logo.PROMPT_CONTINUE,
        function(line) { logo.tokenize(line, f, state); });
    } else {
      logo.trace(", tokens: [{0}]".fmt(state.tokens.map($show).join(" ")));
      f(undefined, state.tokens);
    }
  };

  // Normal evalution mode (i.e. not a function definition)
  logo.eval_regular_line = function(tokens, f)
  {
    logo.eval_loop(tokens, function(error, value) {
        if (error) {
          f(error);
        } else if (tokens.length !== 0) {
          f(logo.error.$new("INTERNAL_ERROR",
              "There should be no input left?!"));
        } else {
          f(undefined, value);
        }
      }, logo.$undefined.$new());
  };

  // Read a line starting with TO
  logo.read_procedure_definition = function(tokens, input, f)
  {
    var args = [];
    var to = tokens.shift();
    var is_macro = to.is_procedure(".MACRO");
    logo.scope.current_token = to;
    if (tokens.length > 0) {
      // Read the name of the procedure
      var name = tokens.shift();
      if (!name.is_a(logo.procedure)) {
        f(logo.error.$new("DOESNT_LIKE", name.show()));
      } else if (name.value.toUpperCase() in logo.procedures) {
        f(logo.error.$new("ALREADY_DEFINED", name.show()));
      } else {
        var required_ok = true;  // can read required inputs (THING "x)
        var optional_ok = true;  // can read optional inputs [:x "y]
        var rest_ok = true;      // can read rest input [:x]
        var default_ok = true;   // can read default number n
        var min_args = 0;        // min number of arguments (i.e. req'd)
        var max_args = 0;        // max number of arguments (maybe ∞)
        var default_args = 0;    // default number of arguments
        (function read_var() {
          if (tokens.length === 0) {
            delete logo.scope.current_token;
            logo.read_procedure_body(f, { to: to,
              name: name.value.toUpperCase(), args: args, source: input,
              tokens: [], is_macro: is_macro, min_args: min_args,
              max_args: max_args || min_args,
              default_args: default_args || min_args });
          } else {
            var input = tokens.shift();
            if (required_ok && input.is_thing) {
              // Read a required input
              args.push(input.value[1].value);
              ++min_args;
              read_var();
            } else if (optional_ok && input.is_list &&
              input.value.length > 1) {
              var m = input.value[0].value
                .match(/^:((?:[^\s\[\]\(\)+\-*\/=<>;\\]|(?:\\.))+)/);
              if (m) {
                // Read an optional input
                input.value.shift();
                args.push([m[1].replace(/\\(.)/g, "$1"), input]);
                required_ok = false;
                read_var();
              } else {
                f(logo.error.$new("DOESNT_LIKE", input.show()));
              }
            } else if (rest_ok && input.is_list &&
                input.value.length === 1) {
              var m = input.value[0].value
                .match(/^:((?:[^\s\[\]\(\)+\-*\/=<>;\\]|(?:\\.))+)/);
              if (m) {
                // Read a rest input
                args.push([m[1].replace(/\\(.)/g, "$1")]);
                max_args = Infinity;
                required_ok = false;
                optional_ok = false;
                rest_ok = false;
                read_var();
              } else {
                f(logo.error.$new("DOESNT_LIKE", input.show()));
              }
            } else if (default_ok && input.is_integer) {
              // Read a default number of arguments
              required_ok = false;
              optional_ok = false;
              rest_ok = false;
              default_ok = false;
              default_args = input.value;
              read_var();
            } else {
              f(logo.error.$new("DOESNT_LIKE", input.show()));
            }
          }
        })();
      }
    }
  };

  // Read a procedure body (after the title line, storing all tokens and
  // stopping when the single token "END" is found)
  logo.read_procedure_body = function(f, def)
  {
    logo.prompt(logo.PROMPT_DEFINE, function(line) {
        logo.tokenize(line, function(error, tokens) {
            if (error) {
              f(error);
            } else {
              def.source += "\n" + line;
              if (tokens.length === 1 && tokens[0].is_procedure("END")) {
                logo.procedures[def.name] = logo.make_procedure(def);
                f(undefined, logo.$undefined.$new());
              } else {
                def.tokens = def.tokens.concat(tokens);
                logo.read_procedure_body(f, def);
              }
            }
          });
      });
  };

  // Create a procedure from its definition (name, arguments, source and tokens)
  logo.make_procedure = function(definition)
  {
    var p = function(tokens, f)
    {
      var scope = Object.create(logo.scope);
      var parent = scope.parent = logo.scope;
      scope.things = Object.create(parent.things);
      scope.procedure = true;
      scope.exit = function(error, value) {
          logo.scope = parent;
          if (error) {
            f(error);
          } else if (definition.is_macro) {
            value.run(f);
          } else {
            logo.trace("& {0} (exited with value {1})"
                .fmt($scope(), value.show()));
            f(error, value);
          }
        };
      logo.scope = scope;
      // In parens read between min and max args, otherwise the default number
      // of arguments. If we haven't read all arguments instantiate the ones
      // that have not been read with the default expressions.
      var min = logo.scope.current_token.in_parens ? definition.min_args :
        definition.default_args;
      var max = logo.scope.current_token.in_parens ? definition.max_args :
        definition.default_args;
      var n = definition.args.length;
      var m = Math.max(max, n);
      if (definition.max_args === Infinity) {
        var arg_name = definition.args[n - 1][0].toUpperCase();
        logo.scope.things[definition.args[n - 1][0].toUpperCase()] =
          logo.list.$new();
        logo.trace("& rest list {1}={2}".fmt($scope(), arg_name,
            logo.scope.things[arg_name].show()));
      }
      logo.trace("& reading {1}-{2} argument{3}/{4}"
          .fmt($scope(), min, max, max > 1 ? "s" : "", n));
      (function eval_args(i) {
        if (i < m) {
          var j = Math.min(i, n - 1);
          var arg_name = (definition.args[j] instanceof Array ?
            definition.args[j][0] : definition.args[j]).toUpperCase();
          var default_expr = definition.args[j] instanceof Array ?
            definition.args[j][1] : null;
          var rest = definition.args[j] instanceof Array && !default_expr;
          logo.trace("& Getting arg #{1}/{2}: {3} ({4})".fmt($scope(), i,
              j, arg_name, rest ? "regular" : "rest"));
          var g = function(error, value)
          {
            if (error) {
              f(error);
            } else {
              if (rest) {
                logo.scope.things[arg_name].value.push(value);
              } else {
                logo.scope.things[arg_name] = value;
              }
              logo.trace("& {1}={2}".fmt($scope(), arg_name,
                    logo.scope.things[arg_name].show()));
              eval_args(i + 1);
            }
          };
          if (i < min || (i < max && tokens.length > 0)) {
            logo.trace("& normal arg");
            logo.eval(tokens, g);
          } else if (default_expr) {
            logo.trace("& default arg");
            default_expr.run(g);
          } else {
            logo.trace("& nothing left");
            eval_args(m);
          }
        } else {
          delete logo.scope.current_token;
          var tokens_ = definition.tokens.slice(0);
          logo.trace("& {0} <{1}>".fmt($scope(),
              tokens_.map(function(x) { return x.show(); }).join(" ")));
          logo.eval_loop(tokens_, function(error, value) {
              if (error) {
                f(error);
              } else if (tokens_.length !== 0) {
                f(logo.error.$new("INTERNAL_ERROR",
                    "There should be no input left?!"));
              } else {
                logo.scope.exit(undefined, value);
              }
            }, logo.$undefined.$new());
        }
      })(0);
    };
    p._source = definition.source;
    return p;
  };


  // Global scope
  logo.scope_global = logo.scope = { things: {} };

  // Redefine this function to show trace messages
  logo.trace = function() {};

  // Global Mersenne Twister used by RANDOM/RERANDOM
  var MERSENNE_TWISTER = populus.mersenne_twister.$new();

  // (Re)set the seed for the randomizer
  logo.set_seed = function(seed) { MERSENNE_TWISTER.set_seed(seed); };

  // Show the current scope (as used by trace)
  function $scope()
  {
    var chain = "";
    (function ch(scope) {
      if (scope) {
        ch(scope.parent);
        chain += "[{0}{1}{2}{3}]"
          .fmt(scope.hasOwnProperty("current_token") ?
            scope.current_token : "",
            scope.hasOwnProperty("current_token") &&
            scope.current_token.in_parens ? "*" :
            scope.hasOwnProperty("procedure") ? "&" :
            scope.hasOwnProperty("slots") ? "#" : "",
            scope.precedence > 0 ? "/{0}".fmt(scope.precedence) : "",
            scope.hasOwnProperty("exit") ? "!" : "");
      }
    })(logo.scope);
    return chain;
  }

  // Check whether the current token is to be consumed by the current
  // procedure or swapped with the following infix operator if any
  function infix_swap(value, tokens, f)
  {
    if (value.is_datum && tokens.length > 0 && tokens[0].is_a(logo.infix) &&
        tokens[0].precedence > (logo.scope.precedence || 0)) {
      logo.trace("% swap {0} {1}".fmt(value.show(), tokens[0].show()));
      value.swapped = true;
      tokens.splice(0, 1, value)[0].apply(tokens, f);
    } else {
      f(undefined, value);
    }
  }

  // An undefined word (and the base for the hierarchy of tokens)
  logo.$undefined = populus.object.create({

      apply: function(tokens, f)
      {
        logo.trace("= {0} > {1}".fmt($scope(), this.show()));
        infix_swap(this, tokens, f);
      },

      butfirst: function() { return this; },
      butlast: function() { return this; },
      equalp: function(t) { return false; },
      fput: function(_, f) {
          f(logo.error.$new("DOESNT_LIKE", this.show()));
        },
      is_procedure: function() { return false; },
      item: function(i) { return this; },
      lput: function(_, f) {
          f(logo.error.$new("DOESNT_LIKE", this.show()));
        },
      run: function(f) {
          f(logo.error.$new("DOESNT_LIKE", this.show()));
        },
      show: function(surface) { return "*undefined*"; },
      toString: function() { return "*undefined*"; }
    });

  // An error
  logo.error = logo.$undefined.create({

      init: function(short_string)
      {
        var self = this.call_super("init");
        var msg = this.error_messages[short_string] ||
          this.error_messages.UNKNOWN_ERROR;
        var args = Array.prototype.slice.call(arguments, 1);
        args.unshift($show(logo.scope.current_token));
        self.message = String.prototype.fmt.apply(msg, args);
        return self;
      },

      apply: function(tokens, f) { f(this); },
      show: function() { return this.message },
      toString: function() { return this.message },

      error_messages: {
        ALREADY_DEFINED: "{1} is already defined",
        ASSUMING_IF_ELSE: "Assuming you mean IFELSE, not IF",
        CANT_USE_HERE: "Can't use {0} here",
        DOESNT_LIKE: "{0} doesn't like {1} as input",
        HOW_TO: "I don't know how to {1}",
        INTERNAL_ERROR: "Internal error: {1}",
        IS_A_PRIMITIVE: "{1} is a primitive",
        NO_TEST: "{0} without TEST",
        NO_VAR: "{1} has no value",
        NOT_ENOUGH_INPUTS: "Not enough inputs to {0}",
        TOO_MUCH_INSIDE_PARENS: "Too much inside ()'s",
        UNEXPECTED_BRACKET: 'Unexpected "]"',
        UNEXPECTED_INPUT: 'Unexpected input: "{1}"',
        UNEXPECTED_PAREN: 'Unexpected ")"',
        UNKNOWN_ERROR: "Unknown error",
        WHAT_TO_DO: "I don't say what to do with {1}",
      },
  });


  // A Logo word
  logo.word = logo.$undefined.create({
      init: function(value, surface) {
          var self = this.call_super("init");
          self.value = value;
          if (surface) self.surface = surface;
          return self;
        },
      butfirst: function() { return logo.new_word(this.toString().substr(1)); },
      butlast: function() {
          return logo.new_word(this.toString()
            .substr(0, this.toString().length - 1));
        },
      contains: function(thing) {
          return thing.is_word && thing.count === 1 &&
            this.toString().indexOf(thing) >= 0;
        },
      count: { enumerable: true, configurable: true,
          get: function() { return this.toString().length; } },
      equalp: function(t) { return this.is_word && this.value === t.value; },
      fput: function(thing, f) {
          if (thing.is_word && thing.toString().length === 1) {
            f(undefined, logo.new_word(thing.toString() + this.toString()));
          } else {
            f(logo.error.$new("DOESNT_LIKE", thing.show()));
          }
        },
      is_datum: true,
      is_defined: true,
      is_word: true,
      item: function(i) {
          return logo.new_word(this.toString().substr(i - 1, 1));
        },
      lput: function(thing, f) {
          if (thing.is_word && thing.value.length === 1) {
            f(undefined, logo.new_word(this.toString() + thing.toString()));
          } else {
            f(logo.error.$new("DOESNT_LIKE", this.show()));
          }
        },
      show: function(surface) {
          return surface && this.surface || this.toString();
        },
      toString: function() { return this.value.toString(); },
    });


  // A number (a float), can be specialized as an integer
  logo.number = logo.word.create({
      equalp: function(t) { return t.is_number && this.value === t.value; },
      is_number: true,
    });


  // An integer (although of course its value is still a float...)
  logo.integer = logo.number.create({
      equalp: function(t) { return t.is_integer && this.value === t.value; },
      is_integer: true,
    });


  // A boolean (TRUE or FALSE)
  logo.boolean = logo.word.create({
      is_false: { enumerable: true, get: function() { return !this.value; } },
      is_true: { enumerable: true, get: function() { return this.value; } },
    });


  // A procedure invocation token
  logo.procedure = logo.word.create({

      // Create a procedure invocation token with a precedence of 0 (for prefix
      // operators; infix operators can pass a precedence value)
      init: function(value, surface, precedence)
      {
        var self = this.call_super("init", value, surface);
        self.precedence = precedence || 0;
        return self;
      },

      // Apply this procedure: consume the necessary tokens for evaluating the
      // arguments and call the continuation function with an error or a value
      // on success.
      apply: function(tokens, f)
      {
        var p = logo.procedures[this.value];
        if (typeof p === "function") {
          var scope = Object.create(logo.scope);
          scope.parent = logo.scope;
          scope.current_token = this;
          scope.precedence = this.precedence;
          logo.scope = scope;
          logo.trace("< {0}".fmt($scope()));
          p(tokens, function(error, value) {
              logo.trace("> {0} = {1}".fmt($scope(), $show(value)));
              logo.scope = logo.scope.parent;
              f(error, value);
            });
        } else {
          f(logo.error.$new("HOW_TO", this.show()));
        }
      },

      is_datum: false,
      is_procedure: function(p) { return this.value === p; },
    });

  // An infix procedure invocation token (e.g. +, -, etc.)
  logo.infix = logo.procedure.create();


  // The list token has an array of tokens for values
  logo.list = logo.word.create({
      init: function() {
          var self = this.call_super("init");
          self.value = [];
          return self;
        },
      butfirst: function() {
          var list = logo.list.$new();
          list.value = this.value.slice(1);
          return list;
        },
      butlast: function() {
          var list = logo.list.$new();
          list.value = this.value.slice(0, this.value.length - 1);
          return list;
        },
      contains: function(thing) {
          for (var i = 0, n = this.value.length; i < n; ++i) {
            if (this.value[i].equalp(thing)) return true;
          }
          return false;
        },
      count: { enumerable: true, configurable: true,
          get: function() { return this.value.length; } },
      equalp: function(token) {
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
        },
      fput: function(t, f) {
          var list = logo.list.$new();
          list.value = this.value.slice(0);
          list.value.unshift(t);
          f(undefined, list);
        },
      is_list: true,
      is_word: false,
      item: function(i) { return this.value[i - 1]; },
      lput: function(t, f) {
          var list = logo.list.$new();
          list.value = this.value.slice(0);
          list.value.push(t);
          f(undefined, list);
        },

      // Evaluate the list as a list of tokens
      run: function(f) {
          logo.tokenize(this.toString(), function(error, tokens) {
              if (error) {
                f(error)
              } else {
                (function loop(val) {
                  if (tokens.length === 0) {
                    f(undefined, val);
                  } else {
                    logo.eval_token(tokens, loop, f);
                  }
                })(logo.$undefined.$new());
              }
            });
        },

      show: function() { return "[" + this.toString() + "]"; },
      toString: function() {
          return this.value.map(function(x) {
              var s = x.toString();
              return x.is_list ? "[" + s + "]" : s;
            }).join(" ");
        },
    });


  // A group is a meta token that contains a parenthesized group
  logo.group = logo.list.create({
      apply: function(tokens, f) {
          var tokens_ = this.value.slice(0);
          if (tokens_.length > 0) {
            logo.trace("( {0}".fmt($scope()));
            logo.eval(tokens_, function(error, value) {
                logo.trace(") {0} {1}".fmt($scope(), error || value));
                if (error || tokens_.length === 0) {
                  f(error, value);
                } else {
                  f(logo.error.$new("TOO_MUCH_INSIDE_PARENS"));
                }
              });
          } else {
            f(error);
          }
        },
      is_list: false,
      is_thing: { get: function() {
            return this.value.length === 2 &&
              this.value[0].is_procedure("THING");
          } },
      show: function() { return "(" + this.call_super("show") + ")"; },
    });


  // Eval the first token of a list of tokens. The token will then consume the
  // rest of list as necessary. The continuation function f(error, value,
  // tokens) is called on both success (with no error and the value of
  // evaluating the token) and error (when there is no token to evaluate.)
  logo.eval = function(tokens, f)
  {
    if (tokens.length > 0) {
      logo.trace("{ {0} <{1}>".fmt($scope(),
            tokens.map(function(x) { return x.show(); }).join(" ")));
      tokens.shift().apply(tokens, function(error, value) {
          if (error) {
            f(error);
          } else {
            logo.trace("} {0} {1}".fmt($scope(), value.show()));
            infix_swap(value, tokens, function(error, value_) {
                if (error) {
                  f(error);
                } else if (value_.is_datum && !logo.scope.current_token) {
                  f(logo.error.$new("WHAT_TO_DO", value_.show()));
                } else {
                  logo.trace("} {0} after swap: {1}"
                    .fmt($scope(), value_.show()));
                  f(undefined, value_);
                }
              });
          }
        });
    } else {
      f(logo.error.$new("NOT_ENOUGH_INPUTS"));
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

  // Create a word token of the correct type given the value (i.e. a word, a
  // number, an integer or a boolean.)
  logo.new_word = function(value, surface)
  {
    logo.trace("+ new word: value={{0}}, surface={{1}}".fmt(value, surface));
    var proto = logo.word;
    if (typeof value === "number") {
      proto = value === parseInt(value.toString(), 10) ?
        logo.integer : logo.number;
    } else if (/^[+-]?((\d+(\.\d*)?)|(\d*\.\d+))$/.test(value)) {
      var v = parseFloat(value);
      proto = isNaN(v) ? logo.token :
        v === parseInt(value, 10) ? logo.integer : logo.number;
      value = isNaN(v) ? value : v;
    } else if (typeof value === "boolean") {
      proto = logo.boolean;
    } else if (/^true$/i.test(value)) {
      proto = logo.boolean;
      value = true;
    } else if (/^false$/i.test(value)) {
      proto = logo.boolean;
      value = false;
    }
    // return proto.new(value, surface);
    var w = proto.$new(value, surface);
    logo.trace("= new word: {{0}}".fmt(w.show()));
    return w;
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
      f(logo.error.$new("DOESNT_LIKE", tf.show()));
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
          infix_swap(value, tokens, function(error, value_) {
              if (error) {
                f(error);
              } else {
                g(value_);
              }
            });
        }
      });
  };

  // Same as above, except that before invoking g with the value received from
  // eval, the predicate p is applied to the value to check that this value is
  // what g expects (for instance, test for a word, a list, etc.)
  logo.eval_like = function(tokens, p, g, f)
  {
    logo.eval(tokens, function(error, value) {
        if (error) {
          f(error);
        } else {
          infix_swap(value, tokens, function(error, value) {
              if (error) {
                f(error);
              } else if (!p(value)) {
                f(logo.error.$new("DOESNT_LIKE", value.show()));
              } else {
                g(value);
              }
            });
        }
      });
  };

  // Eval a token, making sure that it is a list
  logo.eval_boolean = function(tokens, g, f)
  {
    logo.eval_like(tokens, function(t) { return t.is_true || t.is_false; },
        g, f);
  };

  logo.eval_integer = function(tokens, g, f)
  {
    logo.eval_like(tokens, function(t) { return t.is_integer; }, g, f);
  };

  logo.eval_list = function(tokens, g, f)
  {
    logo.eval_like(tokens, function(t) { return t.is_list; }, g, f);
  };

  logo.eval_number = function(tokens, g, f)
  {
    logo.eval_like(tokens, function(t) { return t.is_number; }, g, f);
  };

  logo.eval_word = function(tokens, g, f)
  {
    logo.eval_like(tokens, function(t) { return t.is_word; }, g, f);
  };

  // Wrapper around eval to slurp arguments within parens, or an expected
  // number of arguments. The function g gets called for each value with the
  // current accumulated value, initialized by init, and a continuation that it
  // must call on error or success with the new accumulated value.
  logo.eval_slurp = function(tokens, g, f, n, init)
  {
    (function slurp(m, acc) {
      if ((logo.scope.current_token.in_parens && tokens.length === 0) ||
        (!logo.scope.current_token.in_parens && m === 0)) {
        f(undefined, acc);
      } else {
        logo.eval(tokens, function(error, value) {
            if (error) {
              f(error);
            } else {
              infix_swap(value, tokens, function(error, value) {
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
          });
      }
    })(n, init);
  };

  // Wrapper for show to handle undefined values
  function $show(token)
  {
    return token && token.show ? token.show(true) : "undefined";
  }

  // IFTRUE and IFFALSE; i.e., functions that act of the last value of TEST
  function if_test(tokens, f, p)
  {
    if (typeof logo.scope.test !== "boolean") {
      f(logo.error.$new("NO_TEST"));
    } else {
      logo.eval_token(tokens, function(list) {
          for (var scope = logo.scope; !scope.hasOwnProperty("exit");
            scope = scope.parent);
          if (scope.test !== p) {
            f(undefined, logo.$undefined.$new());
          } else {
            list.run(f);
          }
        }, f);
    }
  }

  // Repeat the list a given number of times, then call the current exit
  // function. Used by FOREVER (with Infinity) and REPEAT
  function repeat(list, times)
  {
    var parent = logo.scope;
    logo.scope = Object.create(parent);
    logo.scope.parent = parent;
    logo.scope.repcount = 0;
    logo.scope.exit = function(error, value) {
      logo.scope = parent;
      if (error) {
        logo.trace("@ {0} exit with error {1}".fmt($scope(), error.show()));
      } else {
        logo.trace("@ {0} exit with value {1}".fmt($scope(), value.show()));
      }
      logo.scope.exit(error, value);
    }
    logo.trace("@ {0} repeat {1} time{2}"
        .fmt($scope(), times, times > 1 ? "s" : ""));
    (function repeat_(error) {
      if (error) {
        logo.scope.exit(error);
      } else if (logo.scope.repcount >= times) {
        logo.trace("@ {0} repeated {1} time{2}".fmt($scope(),
            logo.scope.repcount, logo.scope.repcount > 1 ? "s" : ""));
        logo.scope.exit(undefined, logo.$undefined.$new());
      } else {
        logo.trace("@ {0} repcount={1}".fmt($scope(), logo.scope.repcount));
        ++logo.scope.repcount;
        list.run(repeat_);
      }
    })();
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
        }, f, 2, logo.$undefined.$new());
    },

    // APPLY template inputlist
    //   command or operation.  Runs the "template," filling its slots with
    //   the members of "inputlist."  The number of members in "inputlist"
    //   must be an acceptable number of slots for "template."  It is
    //   illegal to apply the primitive TO as a template, but anything else
    //   is okay.  APPLY outputs what "template" outputs, if anything.
    APPLY: function(tokens, f)
    {
      logo.eval_token(tokens, function(template) {
          logo.eval_list(tokens, function(inputlist) {
              var parent = logo.scope;
              logo.scope = Object.create(parent);
              logo.scope.parent = parent;
              logo.scope.slots = inputlist.value;
              logo.scope.exit = function(error, value)
              {
                if (error) {
                  f(error);
                } else {
                  logo.scope = parent;
                  f(undefined, value);
                }
              };
              logo.trace("# {0} apply template (inputs)".fmt($scope()));
              if (template.is_word) {
                // Second form: apply "function-name [arguments]
                var group = logo.group.$new();
                var procedure =
                  logo.procedure.$new(template.value.toUpperCase());
                procedure.in_parens = true;
                group.value.push(procedure);
                logo.scope.slots.forEach(function(slot) {
                    group.value.push(slot);
                  });
                group.apply(tokens, logo.scope.exit);
              } else if (template.is_list) {
                if (template.count > 1 && template.value[0].is_list &&
                    template.value[0].count === inputlist.count) {
                  // Third form aka lambda
                  var args = template.value.shift();
                  logo.scope.things = Object.create(logo.scope.things);
                  args.value.forEach(function(name, i) {
                      // TODO error if name is not a word
                      logo.scope.things[name.value.toUpperCase()] =
                        logo.scope.slots[i];
                    });
                  template.run(function(error, value) {
                    if (error) {
                      f(error);
                    } else {
                      template.value.unshift(args);
                      logo.scope.exit(undefined, value);
                    }
                  })
                } else {
                  // First form: apply [?1 + ?2] [x y]
                  template.run(logo.scope.exit);
                }
              } else {
                f(logo.error.$new("DOESNT_LIKE", template.show()));
              }
            }, f);
        }, f);
    },

    // ARCTAN num
    // (ARCTAN x y)
    //   outputs the arctangent, in degrees, of its input.  With two
    //   inputs, outputs the arctangent of y/x, if x is nonzero, or
    //   90 or -90 depending on the sign of y, if x is zero.
    ARCTAN: function(tokens, f)
    {
      if (logo.scope.current_token.in_parens) {
        logo.eval_number(tokens, function(x) {
            logo.eval_number(tokens, function(y) {
                if (x.value === 0) {
                  f(undefined, logo.new_word(populus.sign(y.value) * 90));
                } else {
                  f(undefined, logo
                    .new_word(populus.degrees(Math.atan(y.value / x.value))));
                }
              }, f);
          }, f);
      } else {
        logo.eval_number(tokens, function(num) {
            f(undefined, logo.new_word(populus.degrees(Math.atan(num.value))));
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

    // BUTFIRSTS list
    // BFS list
    //   outputs a list containing the BUTFIRST of each member of the input
    //   list.  It is an error if any member of the input list is empty or an
    //   array.  (The input itself may be empty, in which case the output is
    //   also empty.)  This could be written as
    //     to butfirsts :list
    //     output map "butfirst :list
    //     end
    //   but is provided as a primitive in order to speed up the iteration
    //   tools MAP, MAP.SE, and FOREACH.
    BUTFIRSTS: function(tokens, f)
    {
      var bfs = logo.list.$new();
      logo.eval_list(tokens, function(list) {
          var error;
          for (var i = 0, n = list.value.length, error; i < n && !error; ++i) {
            var v = list.value[i];
            if (typeof v.count !== "number" || v.count === 0) {
              error = logo.error.$new("DOESNT_LIKE", v.show());
            } else {
              bfs.value.push(v.butfirst());
            }
          }
          if (error) {
            f(error);
          } else {
            f(undefined, bfs);
          }
        }, f);
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

    // BYE depends on the context in which Logo is run, so it has no effect by
    // default.
    BYE: function(tokens, f) { f(undefined, logo.$undefined.$new()); },

    // CONTENTS
    //   outputs a "contents list," i.e., a list of three lists containing
    //   names of defined procedures, variables, and property lists
    //   respectively.  This list includes all unburied named items in
    //   the workspace.
    CONTENTS: function(tokens, f)
    {
      var contents = logo.list.$new();
      var procedures = logo.list.$new();
      for (var p in logo.procedures) {
        if (!logo.procedures[p].primitive) {
          procedures.value.push(logo.new_word(p));
        }
      }
      contents.value.push(procedures);
      var variables = logo.list.$new();
      for (var t in logo.scope.things) variables.value.push(logo.new_word(t));
      contents.value.push(variables);
      var plists = logo.list.$new();
      contents.value.push(plists);
      f(undefined, contents);
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
          if (n in logo.procedures && n.primitive) {
            f(logo.error.$new("ALREADY_DEFINED", newname.show()));
          } else {
            logo.eval_word(tokens, function(oldname) {
                var o = oldname.value.toUpperCase();
                var p = logo.procedures[o];
                if (!p) {
                  f(logo.error.$new("HOW_TO", oldname.show()));
                } else {
                  logo.procedures[n] = p;
                  f(undefined, logo.$undefined.$new());
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
          f(undefined, logo.new_word(Math.cos(populus.radians(degrees.value))));
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
          f(undefined, logo.new_word(v.count));
        }, f);
    },

    // DIFFERENCE num1 num2
    // num1 - num2
    //   outputs the difference of its inputs.  Minus sign means infix
    //   difference in ambiguous contexts (when preceded by a complete
    //   expression), unless it is preceded by a space and followed
    //   by a nonspace.  (See also MINUS.)
    DIFFERENCE: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.new_word(num1.value - num2.value));
            }, f);
        }, f);
    },

    // - can be either DIFFERENCE or MINUS (if the first argument was not
    // swapped)
    "-": function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          if (num1.swapped) {
            logo.eval_number(tokens, function(num2) {
                f(undefined, logo.new_word(num1.value - num2.value));
              }, f);
          } else {
            f(undefined, logo.new_word(-num1.value));
          }
        }, f);
    },

    // EMPTYP thing
    // EMPTY? thing
    //   outputs TRUE if the input is the empty word or the empty list,
    //   FALSE otherwise.
    EMPTYP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          f(undefined, logo.new_word(thing.count === 0))
        }, f);
    },

    // EQUALP thing1 thing2
    // EQUAL? thing1 thing2
    // thing1 = thing2
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
              f(undefined, logo.new_word(thing1.equalp(thing2)));
            }, f);
        }, f);
    },

    // ERASE contentslist
    // ER contentslist
    //   command.  Erases from the workspace the procedures, variables,
    //   and property lists named in the input.  Primitive procedures may
    //   not be erased unless the variable REDEFP has the value TRUE.
    // TODO maybe don't erase function parameters?
    ERASE: function(tokens, f)
    {
      var erase_variables = function(contentslist)
      {
        var vars = contentslist.value[1];
        (function erase() {
          if (vars.count === 0) {
            erase_procedures(contentslist.value[0]);
          } else {
            var v = vars.value.shift().value.toUpperCase();
            if (v in logo.scope.things) delete logo.scope.things[v];
            erase();
          }
        })();
      };
      var erase_procedures = function(procedures)
      {
        (function erase() {
          if (procedures.count === 0) {
            f(undefined, logo.$undefined.$new());
          } else {
            var p = procedures.value.shift();
            if (!p.is_word) {
              f(logo.error.$new("DOESNT_LIKE", p.show()));
            } else {
              var p_ = logo.procedures[p.value.toUpperCase()];
              if (!p_) {
                logo.warn(logo.error.$new("DOESNT_LIKE", p.show()));
              } else if (p_.primitive) {
                logo.warn(logo.error.$new("IS_A_PRIMITIVE", p.show()));
              } else {
                delete logo.procedures[p.value.toUpperCase()];
              }
              erase();
            }
          }
        })();
      };
      logo.eval_token(tokens, function(contentslist) {
          if (contentslist.is_word) {
            var list = logo.list.$new();
            list.value.push(contentslist);
            erase_procedures(list);
          } else if (contentslist.is_list &&
              contentslist.count === 3 &&
              contentslist.value[0].is_list &&
              contentslist.value[1].is_list &&
              contentslist.value[2].is_list) {
            // erase variables, which will call erase_procedures when done
            erase_variables(contentslist);
          } else {
            erase_procedures(contentslist);
          }
        }, f);
    },

    // EXP num
    //   outputs e (2.718281828+) to the input power.
    EXP: function(num)
    {
      logo.eval_number(tokens, function(num) {
          f(undefined, logo.new_word(Math.exp(num.value)));
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
      var firsts = logo.list.$new();
      logo.eval_list(tokens, function(list) {
          var error;
          for (var i = 0, n = list.value.length, error; i < n && !error; ++i) {
            var v = list.value[i];
            if (typeof v.count !== "number" || v.count === 0) {
              error = logo.error.$new("DOESNT_LIKE", v.show());
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
      logo.eval_list(tokens, function(list) { repeat(list, Infinity); }, f);
    },

    // FPUT thing list
    //   outputs a list equal to its second input with one extra member,
    //   the first input, at the beginning.  If the second input is a word,
    //   then the first input must be a one-letter word, and FPUT is
    //   equivalent to WORD.
    FPUT: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          logo.eval_token(tokens, function(list) { list.fput(thing, f); }, f);
        }, f);
    },

    // GREATEREQUALP num1 num2
    // GREATEREQUAL? num1 num2
    // num1 >= num2
    //   outputs TRUE if its first input is greater than or equal to its second.
    GREATEREQUALP: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.new_word(num1.value >= num2.value));
            }, f);
        }, f);
    },

    // GREATERP num1 num2
    // GREATER? num1 num2
    // num1 > num2
    //   outputs TRUE if its first input is strictly greater than its second.
    GREATERP: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.new_word(num1.value > num2.value));
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
              if ((logo.scope.current_token.in_parens && tokens.length > 0 ||
                  tokens.length > 0 && tokens[0].is_list)) {
                if (!logo.scope.current_token.in_parens) {
                  logo.warn(logo.error.$new("ASSUMING_IF_ELSE"));
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
                f(undefined, logo.$undefined.$new());
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
          f(undefined, logo.new_word(Math.floor(num.value)));
        }, f);
    },

    // INTEGERP thing
    // INTEGER? thing
    //   outputs TRUE if the input is an integer, FALSE otherwise.
    INTEGERP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          f(undefined, logo.new_word(thing.is_a(logo.integer)));
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
              f(undefined, thing.item(index.value));
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
    // num1 <= num2
    //   outputs TRUE if its first input is less than or equal to its second.
    LESSEQUALP: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.new_word(num1.value <= num2.value));
            }, f);
        }, f);
    },

    // LESSP num1 num2
    // LESS? num1 num2
    // num1 < num2
    //   outputs TRUE if its first input is strictly less than its second.
    LESSP: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.new_word(num1.value < num2.value));
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
        }, f, 2, logo.list.$new());
    },

    // LISTP thing
    // LIST? thing
    //   outputs TRUE if the input is a list, FALSE otherwise.
    LISTP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          f(undefined, logo.new_word(thing.is_list));
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
      if (logo.scope.current_token.in_parens) {
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
          f(undefined, logo.$undefined.$new());
        } else {
          var varname = varnames.shift();
          if (!varname.is_word) {
            f(logo.error.$new("DOESNT_LIKE", varname.show()));
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
          f(undefined, logo.new_word(Math.log(num.value)));
        }, f);
    },

    // LOG10 num
    //   outputs the common logarithm of the input.
    LOG10: function(tokens, f)
    {
      logo.eval_number(tokens, function(num) {
          f(undefined, logo.new_word(Math.log(num.value) / Math.log(10)));
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
          logo.eval_token(tokens, function(list) { list.lput(thing, f); }, f);
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
              f(undefined, logo.$undefined.$new());
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
              f(undefined, logo.new_word(thing2.contains(thing1)));
            }, f);
        }, f);
    },

    // MINUS num
    // - num
    //   outputs the negative of its input.  Minus sign means unary minus if
    //   the previous token is an infix operator or open parenthesis, or it is
    //   preceded by a space and followed by a nonspace.  There is a difference
    //   in binding strength between the two forms:
    //     MINUS 3 + 4  means  -(3+4)
    //     - 3 + 4    means  (-3)+4
    MINUS: function(tokens, f)
    {
      logo.eval_number(tokens, function(num) {
          f(undefined, logo.new_word(-num.value));
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
                logo.new_word(populus.sign(num2.value) *
                  Math.abs(num1.value % num2.value)));
            }, f);
        }, f);

    },

    // NOT tf
    //   outputs TRUE if the input is FALSE, and vice versa.  The input can be
    //   a list, in which case it is taken as an expression to run; that
    //   expression must produce a TRUE or FALSE value.
    NOT: function(tokens, f)
    {
      logo.eval_token(tokens, function(tf) {
          $check_tf(tf, function(error, tf_) {
              if (error) {
                f(error);
              } else {
                tf_.value = !tf_.value;
                f(error, tf_);
              }
            });
        }, f);
    },

    // NOTEQUALP thing1 thing2
    // NOTEQUAL? thing1 thing2
    // thing1 <> thing2
    //   outputs FALSE if the inputs are equal, TRUE otherwise.  See EQUALP
    //   for the meaning of equality for different data types.
    NOTEQUALP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing1) {
          logo.eval_token(tokens, function(thing2) {
              f(undefined, logo.new_word(!thing1.equalp(thing2)));
            }, f);
        }, f);
    },

    // NUMBERP thing
    // NUMBER? thing
    //   outputs TRUE if the input is a number, FALSE otherwise.
    NUMBERP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          f(undefined, logo.new_word(thing.is_a(logo.number)));
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
        }, f, 2, logo.$undefined.$new());
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

    // PARSE word
    //   outputs the list that would result if the input word were entered
    //   in response to a READLIST operation.  That is, PARSE READWORD has
    //   the same value as READLIST for the same characters read.
    PARSE: function(tokens, f)
    {
      logo.eval_word(tokens, function(word) {
          var list = "[" + word.value.replace(/~\n/g, "")
              .replace(/((^|[^\\])(\\\\)*);/g, "$1\\;") + "]";
          logo.tokenize(list, function(error, tokens) {
              if (tokens.length === 1 && tokens[0].is_list) {
                f(undefined, tokens[0]);
              } else {
                f(logo.error.$new("DOESNT_LIKE", "[{0}]".fmt(word.show())));
              }
            });
        }, f);
    },

    // POWER num1 num2
    //   outputs "num1" to the "num2" power.  If num1 is negative, then
    //   num2 must be an integer.
    POWER: function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo["eval_" + (num1.value < 0 ? "integer" : "number")](tokens,
            function(num2) {
              f(undefined, logo.new_word(Math.pow(num1.value, num2.value)));
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
      var list = logo.list.$new();
      for (var p in logo.procedures) {
        if (logo.procedures[p].primitive) list.value.push(logo.new_word(p));
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
          g(undefined, logo.$undefined.$new());
        }, f, 1);
    },

    // PRODUCT num1 num2
    // (PRODUCT num1 num2 num3 ...)
    // num1 * num2
    //   outputs the product of its inputs.
    PRODUCT: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(n, product, g) {
          if (!n.is_number) {
            g(logo.error.$new("DOESNT_LIKE", n.show()));
          } else {
            g(undefined, logo.new_word(n.value * product.value));
          }
        }, f, 2, logo.new_word(1));
    },

    // * is only binary, no slurping
    "*": function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.new_word(num1.value * num2.value));
            }, f);
        }, f);
    },

    // PRINTOUT contentslist
    // PO contentslist
    //   command.  Prints to the write stream the definitions of all
    //    procedures, variables, and property lists named in the input
    //    contents list.
    // TODO update for contentslist
    /*PRINTOUT: function(tokens, f)
    {
      logo.eval_token(tokens, function(list) {
          var words = list.is_word ? [list] : list.value.slice(0);
          (function po() {
            if (words.length === 0) {
              f(undefined, logo.$undefined.new());
            } else {
              var word = words.shift();
              if (!word.is_word) {
                f(logo.error(logo.ERR_DOESNT_LIKE, $show(word)));
              } else {
                var p = logo.procedures[word.value.toUpperCase()];
                if (!p) {
                  f(logo.error(logo.ERR_DOESNT_LIKE, $show(word)));
                } else if (p.primitive) {
                  f(logo.error(logo.ERR_IS_A_PRIMITIVE, $show(word)));
                } else {
                  logo.print(p._source);
                  po();
                }
              }
            }
          })();
        }, f);
    },*/

    // QUOTIENT num1 num2
    // (QUOTIENT num)
    // num1 / num2
    //   outputs the quotient of its inputs.  The quotient of two integers
    //   is an integer if and only if the dividend is a multiple of the divisor.
    //   (In other words, QUOTIENT 5 2 is 2.5, not 2, but QUOTIENT 4 2 is
    //   2, not 2.0 -- it does the right thing.)  With a single input,
    //   QUOTIENT outputs the reciprocal of the input.
    QUOTIENT: function(tokens, f)
    {
      if (logo.scope.current_token.in_parens) {
        logo.eval_number(tokens, function(num) {
            f(undefined, logo.new_word(1 / num.value));
          }, f);
      } else {
        logo.eval_number(tokens, function(num1) {
            logo.eval_number(tokens, function(num2) {
                f(undefined, logo.new_word(num1.value / num2.value));
              }, f);
          }, f);
      }
    },

    // / is only binary, no unary quotient
    "/": function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.new_word(num1.value / num2.value));
            }, f);
        }, f);
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
      if (logo.scope.current_token.in_parens) {
        logo.eval_number(tokens, function(x) {
            logo.eval_number(tokens, function(y) {
                if (x.value === 0) {
                  f(undefined, logo
                    .new_word(populus.sign(y.value) * Math.PI / 2));
                } else {
                  f(undefined, logo.new_word(Math.atan(y.value / x.value)));
                }
              }, f);
          }, f);
      } else {
        logo.eval_number(tokens, function(num) {
            f(undefined, logo.new_word(Math.atan(num.value)));
          }, f);
      }
    },

    // RADCOS radians
    //   outputs the cosine of its input, which is taken in radians.
    RADCOS: function(tokens, f)
    {
      logo.eval_number(tokens, function(radians) {
          f(undefined, logo.new_word(Math.cos(radians.value)));
        }, f);
    },

    // RADSIN radians
    //   outputs the sine of its input, which is taken in radians.
    RADSIN: function(tokens, f)
    {
      logo.eval_number(tokens, function(radians) {
          f(undefined, logo.new_word(Math.sin(radians.value)));
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
      if (logo.scope.current_token.in_parens) {
        logo.eval_integer(tokens, function(start) {
            logo.eval_integer(tokens, function(end) {
                if (end.value - start.value < 0) {
                  f(logo.error.$new("DOESNT_LIKE", start.show()));
                } else {
                  f(undefined, logo.new_word(MERSENNE_TWISTER
                      .next_integer(start.value, end.value + 1)));
                }
              }, f);
          }, f);
      } else {
        logo.eval_integer(tokens, function(num) {
            if (num.value < 1) {
              f(logo.error.$new("DOESNT_LIKE", num.show()));
            } else {
              f(undefined, logo
                .new_word(MERSENNE_TWISTER.next_integer(num.value)));
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
      logo.prompt(logo.PROMPT_READ, function(input) {
          var list = "[" + input.replace(/((^|[^\\])(\\\\)*);/g, "$1\\;") + "]";
          logo.tokenize(list, function(error, tokens) {
              if (tokens.length === 1 && tokens[0].is_list) {
                f(undefined, tokens[0]);
              } else {
                f(logo.error.$new("DOESNT_LIKE", "[{0}]".fmt(input)));
              }
            });
        });
    },

    // READRAWLINE
    //   reads a line from the read stream and outputs that line as a word.
    //   The output is a single word even if the line contains spaces,
    //   brackets, etc.  If the read stream is a file, and the end of file is
    //   reached, READRAWLINE outputs the empty list (not the empty word).
    //   READRAWLINE outputs the exact string of characters as they appear
    //   in the line, with no special meaning for backslash, vertical bar,
    //   tilde, or any other formatting characters.
    READRAWLINE: function(tokens, f)
    {
      logo.prompt_raw(logo.PROMPT_READ, function(line) {
          f(undefined, logo.new_word(line));
        });
    },

    // READWORD
    // RW
    //   reads a line from the read stream and outputs that line as a word.
    //   The output is a single word even if the line contains spaces,
    //   brackets, etc.  If the read stream is a file, and the end of file is
    //   reached, READWORD outputs the empty list (not the empty word).
    //   READWORD processes backslash, vertical bar, and tilde characters in
    //   the read stream.  In the case of a tilde used for line continuation,
    //   the output word DOES include the tilde and the newline characters, so
    //   that the user program can tell exactly what the user entered.
    //   Vertical bars in the line are also preserved in the output.
    //   Backslash characters are not preserved in the output.
    READWORD: function(tokens, f)
    {
      (function read(input)
      {
        logo.prompt_raw(logo.PROMPT_READ, function(line) {
            var m = line.match(/(^|[^\\])(\\\\)*[~\\]$/);
            if (m) {
              read(input + line + "\n");
            } else {
              f(undefined,
                logo.new_word((input + line).replace(/\\(.|\n)/g, "$1")));
            }
          });
      })("");
    },

    // REMAINDER num1 num2
    //   outputs the remainder on dividing "num1" by "num2"; both must be
    //   integers and the result is an integer with the same sign as num1.
    REMAINDER: function(tokens, f)
    {
      logo.eval_integer(tokens, function(num1) {
          logo.eval_integer(tokens, function(num2) {
              f(undefined,
                logo.new_word(populus.sign(num1.value) *
                  Math.abs(num1.value % num2.value)));
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
      f(undefined, logo.new_word(logo.scope.repcount || -1));
    },

    // REPEAT num instructionlist
    //   command.  Runs the "instructionlist" repeatedly, "num" times.
    REPEAT: function(tokens, f)
    {
      logo.eval_integer(tokens, function(num) {
          logo.eval_list(tokens, function(list) {
              repeat(list, num.value);
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
      if (logo.scope.current_token.in_parens) {
        logo.eval_integer(tokens, function(seed) {
            MERSENNE_TWISTER.set_seed(seed.value);
            f(undefined, logo.$undefined.$new());
          }, f);
      } else {
        MERSENNE_TWISTER.set_seed();
        f(undefined, logo.$undefined.$new());
      }
    },

    // ROUND num
    // outputs the nearest integer to the input.
    ROUND: function(tokens, f)
    {
      logo.eval_number(tokens, function(num) {
          f(undefined, logo.new_word(Math.round(num.value)));
        }, f);
    },

    // RUN instructionlist
    //   command or operation.  Runs the Logo instructions in the input
    //   list; outputs if the list contains an expression that outputs.
    RUN: function(tokens, f)
    {
      logo.eval_list(tokens, function(list) { list.run(f); }, f);
    },

    // RUNPARSE wordorlist
    //   outputs the list that would result if the input word or list were
    //   entered as an instruction line; characters such as infix operators
    //   and parentheses are separate members of the output.  Note that
    //   sublists of a runparsed list are not themselves runparsed.
    RUNPARSE: function(tokens, f)
    {
      logo.eval_token(tokens, function(wordorlist) {
          var list = "[" + wordorlist.toString().replace(/~\n/g, "")
              .replace(/((^|[^\\])(\\\\)*);/g, "$1\\;") + "]";
          logo.tokenize(list, function(error, tokens) {
              if (tokens.length === 1 && tokens[0].is_list) {
                f(undefined, tokens[0]);
              } else {
                f(logo.error.$new("DOESNT_LIKE", "[{0}]".fmt(word.show())));
              }
            });
        }, f);
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
                var out = logo.list.$new();
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
        }, f, 2, logo.list.$new());
    },

    // SHOW thing
    // (SHOW thing1 thing2 ...)
    //   command.  Prints the input or inputs like PRINT, except that
    //   if an input is a list it is printed inside square brackets.
    SHOW: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(v, _, g) {
          logo.print(v.show());
          g(undefined, logo.$undefined.$new());
        }, f, 1);
    },

    // SIN degrees
    //   outputs the sine of its input, which is taken in degrees.
    SIN: function(tokens, f)
    {
      logo.eval_number(tokens, function(degrees) {
          f(undefined, logo.new_word(Math.sin(populus.radians(degrees.value))));
        }, f);
    },

    // SQRT num
    //   outputs the square root of the input, which must be nonnegative.
    SQRT: function(tokens, f)
    {
      logo.eval_number(tokens, function(num) {
          if (num.value < 0) {
            f(logo.error.$new("DOESNT_LIKE", num.show()));
          } else {
            f(undefined, logo.new_word(Math.sqrt(num.value)));
          }
        }, f);
    },

    // STOP
    //   command.  Ends the running of the procedure in which it appears.
    //   Control is returned to the context in which that procedure was
    //   invoked.  The stopped procedure does not output a value.
    STOP: function(tokens, f)
    {
      logo.scope.exit(undefined, logo.$undefined.$new());
    },

    // SUM num1 num2
    // (SUM num1 num2 num3 ...)
    // num1 + num2
    //   outputs the sum of its inputs.
    SUM: function(tokens, f)
    {
      logo.eval_slurp(tokens, function(n, sum, g) {
          if (!n.is_number) {
            g(logo.error.$new("DOESNT_LIKE", n.show()));
          } else {
            g(undefined, logo.new_word(n.value + sum.value));
          }
        }, f, 2, logo.new_word(0));
    },

    // + is only binary, no slurping
    "+": function(tokens, f)
    {
      logo.eval_number(tokens, function(num1) {
          logo.eval_number(tokens, function(num2) {
              f(undefined, logo.new_word(num1.value + num2.value));
            }, f);
        }, f);
    },

    // TEST tf
    //   command.  Remembers its input, which must be TRUE or FALSE, for use
    //   by later IFTRUE or IFFALSE instructions.  The effect of TEST is local
    //   to the procedure in which it is used; any corresponding IFTRUE or
    //   IFFALSE must be in the same procedure or a subprocedure.
    TEST: function(tokens, f)
    {
      logo.eval_token(tokens, function(tf) {
          if (!(tf.is_true || tf.is_false)) {
            f(logo.error.$new("DOESNT_LIKE", tf.show()));
          } else {
            for (var scope = logo.scope; !scope.hasOwnProperty("exit");
              scope = scope.parent);
            scope.test = tf.is_true;
            f(undefined, logo.$undefined.$new());
          }
        }, f);
    },

    // THING varname
    // :quoted.varname
    //   outputs the value of the variable whose name is the input.
    //   If there is more than one such variable, the innermost local
    //   variable of that name is chosen.  The colon notation is an
    //   abbreviation not for THING but for the combination
    //     thing "
    //   so that :FOO means THING "FOO.
    THING: function(tokens, f)
    {
      logo.eval_word(tokens, function(varname) {
          var val = logo.scope.things[varname.value.toUpperCase()];
          if (val) {
            logo.trace("THING {0} = {1}".fmt(varname.value.toUpperCase(), val));
            f(undefined, val);
          } else {
            f(logo.error.$new("NO_VAR", varname.show()));
          }
        }, f);
    },

    // TO is handled in a special manner
    TO: function(tokens, f) { f(logo.error.$new("CANT_USE_HERE")); },

    // WAIT time
    //   command.  Delays further execution for "time" 60ths of a second.
    //   Also causes any buffered characters destined for the terminal to
    //   be printed immediately.  WAIT 0 can be used to achieve this
    //   buffer flushing without actually waiting.
    // TODO something about buffering in Node (if any)
    WAIT: function(tokens, f)
    {
      logo.eval_number(tokens, function(time) {
          if (time.value < 0) {
            f(logo.error.$new("DOESNT_LIKE", time.show()));
          } else {
            setTimeout(function() { f(undefined, logo.$undefined.$new()); },
              time.value * 1000 / 60);
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
            g(logo.error.$new("DOESNT_LIKE", v.show()));
          } else {
            g(undefined, logo.new_word(w.toString() + v.toString()));
          }
        }, f, 2, logo.new_word(""));
    },

    // WORDP thing
    // WORD? thing
    //   outputs TRUE if the input is a word, FALSE otherwise.
    WORDP: function(tokens, f)
    {
      logo.eval_token(tokens, function(thing) {
          f(undefined, logo.new_word(thing.is_word));
        }, f);
    },

    // Get the value of a numbered slot
    "?": function(tokens, f)
    {
      logo.eval_integer(tokens, function(index) {
          var i = index.value - 1;
          logo.trace("# {0} get slot #{1}".fmt($scope(), index.show()));
          if (logo.scope.slots && logo.scope.slots[i]) {
            f(undefined, logo.scope.slots[i]);
          } else {
            f(logo.error.$new("DOESNT_LIKE", index.show()));
          }
        }, f);
    },

  };

})(typeof exports === "undefined" ? this.logo = {} : exports);
