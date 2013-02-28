// A lispy language with Javascript datastructures (numbers, strings, arrays,
// objects and functions), prototypes, and macros.
// Very loosely based on Peter Norvig's Lis.py (http://norvig.com/lispy.html)

(function(m) {
  "use strict";

  // Perl-like string formatting (use $0, $1... in the string, referring to
  // values passed as parameters)
  // Sample use: "foo = $0, bar = $1".fmt(foo, bar)
  String.prototype.fmt = function () {
    var args = arguments;
    return this.replace(/\$(\d+)/g, function (s, p) {
      return args[p] === undefined || args[p] === null ? "" : args[p];
    });
  }

  // Tokenizer
  m.tokenize = function(s) {
    var tokens = [];
    while (true) {
      var m = s
        .match(/\s*(,@|[('`,)]|"(?:[\\].|[^\\"])*"|;.*|[^\s('"`,;)]*)(.*)/);
      if (m && m[1].length > 0 && m[1][0] !== ";") {
        tokens.push(m[1]);
        s = m[2];
      } else {
        return tokens;
      }
    }
  }

}(typeof exports === "object" ? exports : window.minimalisp = {}));
