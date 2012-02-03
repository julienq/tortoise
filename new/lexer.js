var readline = require("readline");
var flexo = require("flexo");

var rli = readline.createInterface(process.stdin, process.stdout);
rli.on("close", function() {
    process.stdout.write("\n");
    process.exit(0);
  });

function prompt(p, f)
{
  rli.setPrompt(p);
  rli.once("line", function(line) { f(line); });
  rli.prompt();
}

var lexer =
{
  init: function(line)
  {
    this.line = line || 0;
    this.open = [];
    this.list = 0;
    this.comment = false;
    this.tilda = false;
    this.escaped = false;
    this.bars = false;
    this.input = "";
    this.tokens = [];
    this.i = 0;
    return this;
  },

  // Get the next token or add to an already created token
  next_token: function()
  {
    this.tilda = false;
    this.comment = false;
    this.escaped = false;
    var l = this.input.length;
    var token;  // current token (may continue from leftover token)
    var begin;  // beginning of a line (start of input or following a newline)

    if (this.leftover) {
      // Continue reading token after line break (after a ~ or escaped newline)
      token = this.leftover;
      delete this.leftover;
    } else {
      // Look for a new token
      for (; this.i < l && /\s/.test(this.input[this.i]); ++this.i) {
        if (this.input[this.i] === "\n") ++this.line;
      }
      if (this.i >= l) return;
      var c = this.input[this.i++];
      var token = { line: this.line };
      if (c === "[") {
        this.open.push(c);
        ++this.list;
        token.value = token.type = token.surface = c;
        return token;
      } else if (this.list === 0 && (c === "(" || c === "{")) {
        this.open.push(c);
        token.value = token.type = token.surface = c;
        return token;
      } else if (c === "]") {
        var open = this.open.pop();
        if (open === "[") {
          --this.list;
          token.value = token.type = token.surface = c;
          return token;
        } else {
          throw "Unmatched \"]\"";
        }
      } else if (this.list === 0 && (c === ")" || c === "}")) {
        var open = this.open.pop();
        if ((open === "(" && c === ")") || (open === "{" && c === "}")) {
          token.value = token.type = token.surface = c;
          return token;
        } else {
          throw "Unmatched \"{0}\"".fmt(c);
        }
      } else if (c === "\"" && this.list === 0) {
        token.value = "";
        token.surface = c;
        token.type = "quoted";
      } else if (c === "<" && this.list === 0) {
        if (this.input[this.i] === "=" || this.input[this.i] === ">") {
          c += this.input[this.i++];
        }
        token.value = token.surface = c;
        token.type = "infix";
        return token;
      } else if (c === ">" && this.list === 0) {
        if (this.input[this.i] === "=") c += this.input[this.i++];
        token.value = token.surface = c;
        token.type = "infix";
        return token;
      } else if ((c === "+" || c === "-" || c === "*" || c === "/" || c === "=")
          && this.list === 0) {
        token.value = token.surface = c;
        token.type = "infix";
        return token;
      } else if (c === ";") {
        this.comment = true;
      } else if ((this.i === 1 || this.input[this.i - 2] === "\n") &&
          c === "#" && this.input[this.i] === "!") {
        this.comment = true;
        ++this.i;
      } else if (c === "~" && this.input[this.i] === "\n") {
        ++this.i;
        ++this.line;
        this.tilda = true;
        return;
      } else {
        if (c === "\\" && this.i < l) {
          this.escaped = true;
          token.value = "";
        } else if (c === "|") {
          this.bars = true;
          token.value = "";
        } else {
          token.value = this.list > 0 ? c : c.toUpperCase();
        }
        token.surface = c;
        token.type = "word";
      }
    }

    // Keep adding to the current token (word, quoted, comment)
    while (this.i < l) {
      c = this.input[this.i];
      if (this.escaped) {
        token.surface += c;
        token.value += this.list > 0 || token.type === "quoted" ?
          c : c.toUpperCase();
        if (c === "\n" && this.i === l - 1) {
          ++this.line;
          this.leftover = token;
          return;
        } else {
          this.escaped = false;
        }
      } else if (this.bars) {
        token.surface += c;
        if (c === "|") {
          this.bars = false;
        } else if (c === "\\" && this.i < l - 1) {
          this.escaped = true;
          token.surface += c;
        } else {
          token.value += this.list > 0 || token.type === "quoted" ?
            c : c.toUpperCase();
          if (c === "\n" && this.i === l - 1) {
            ++this.line;
            this.leftover = token;
            return;
          }
        }
      } else {
        if (c === "~" && this.input[this.i + 1] === "\n") {
          ++this.i;
          ++this.line;
          this.tilda = true;
          this.leftover = token;
          return;
        }
        if (!this.comment) {
          if (c === ";") {
            this.comment = true;
            this.leftover = token;
          } else if (c === "\\" && this.i < l - 1) {
            this.escaped = true;
            token.surface += c;
          } else if (c === "|") {
            this.bars = true;
            this.surface += c;
          } else if (this.list === 0 && (/\s/.test(c) || c === "[" ||
                c === "]" || c === "(" || c === ")" || c === "{" || c === "}" ||
                c === "+" || c === "-" || c === "*" || c === "/" || c === "=" ||
                c === "<" || c === ">") ||
              (this.list > 0 && (/\s/.test(c) || c === "[" || c === "]"))) {
            return token;
          } else {
            token.surface += c;
            token.value += this.list > 0 || token.type === "quoted" ?
              c : c.toUpperCase();
          }
        }
      }
      ++this.i;
    }
    if (token.type && !this.tilda && !this.escaped && !this.bars) {
      delete this.leftover;
      return token;
    }
  },

  // TODO handle END on its own line here
  tokenize: function(input, f)
  {
    this.i = 0;
    this.input = input;
    var token;
    do {
      token = this.next_token();
      if (token) this.tokens.push(token);
    } while (token);
    if (this.open.length === 0 && !this.leftover) {
      var tokens = this.tokens.slice(0);
      this.tokens = [];
      f(tokens);
    } else {
      prompt("{0} ".fmt(this.tilda ? "~" : this.escaped ? "\\" :
            this.bars ? "|" : this.open[this.open.length - 1] || "?"),
          (function(line_) { this.tokenize(line_, f) }).bind(this));
    }
  },
};

var l = Object.create(lexer).init();

function repl(line)
{
  l.tokenize(line + "\n", function(tokens) {
      console.log("{0}\t".fmt(l.line), tokens.map(function(t) {
          return t.type === "quoted" ? "\033[00;46m{0}\033[00m"
            .fmt(t.value || " ") : "\033[00;47m{0}\033[00m".fmt(t.value);
        }).join(" "), tokens.length);
      prompt("? ", repl);
    });
}

prompt("? ", repl);
