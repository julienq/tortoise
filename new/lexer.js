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
    this.mode = "";
    this.open = [];
    this.input = "";
    this.tokens = [];
    this.i = 0;
    return this;
  },

  // Get the next token or add to an already created token
  next_token: function()
  {
    if (this.mode === "~") this.mode = this.open.pop();
    var l = this.input.length;
    for (; this.i < l && /\s/.test(this.input[this.i]); ++this.i) {
      if (this.input[this.i] === "\n") ++this.line;
    }
    if (this.i >= l) return;
    var c = this.input[this.i++];
    var token = { line: this.line };
    if (c === "(" || c === "[" || c === "{") {
      this.open.push(this.mode);
      this.mode = token.value = token.type = token.surface = c;
      return token;
    } else if (c === ")" || c === "]" || c === "}") {
      if ((this.mode === "(" && c === ")") ||
          (this.mode === "[" && c === "]") ||
          (this.mode === "{" && c === "}")) {
        this.mode = this.open.pop();
        token.value = token.type = token.surface = c;
        return token;
      } else {
        throw "Unmatched \"{0}\"".fmt(c);
      }
    } else if (c === "\"" && this.mode !== "[") {
      token.value = "";
      token.surface = c;
      token.type = "quoted";
    } else if (c === "<" && this.mode !== "[") {
      if (this.input[this.i] === "=" || this.input[this.i] === ">") {
        c += this.input[this.i++];
      }
      token.value = token.surface = c;
      token.type = "infix";
      return token;
    } else if (c === ">" && this.mode !== "[") {
      if (this.input[this.i] === "=") c += this.input[this.i++];
      token.value = token.surface = c;
      token.type = "infix";
      return token;
    } else if ((c === "+" || c === "-" || c === "*" || c === "/" || c === "=")
        && this.mode !== "[") {
      token.value = token.surface = c;
      token.type = "infix";
      return token;
    } else if (c === "~" && (this.input[this.i] === "\n" || this.i === l)) {
      // TODO preserve the tilde for readline
      if (this.input[this.i] === "\n") ++this.i;
      this.open.push(this.mode);
      this.mode = "~";
      return;
    } else {
      token.value = this.mode === "" ? c.toUpperCase() : c;
      token.surface = c;
      token.type = "word";
    }
    while (this.i < l) {
      c = this.input[this.i];
      if (c === "~" && (this.input[this.i] === "\n" || this.i === l - 1)) {
        // TODO continue reading this word after the line break
        if (this.input[this.i] === "\n") ++this.i;
        this.open.push(this.mode);
        this.mode = "~";
        return token;
      }
      if ((this.mode === "" && (/\s/.test(c) || c === "[" || c === "]" ||
            c === "(" || c === ")" || c === "{" || c === "}" || c == "+" ||
            c === "-" || c === "*" || c === "/" || c === "=" || c == "<" ||
            c === ">")) ||
          (this.mode === "[" && (/\s/.test(c) || c === "[" || c === "]"))) {
        return token;
      }
      token.surface += c;
      token.value += this.mode === "" ? c.toUpperCase() : c;
      ++this.i;
    }
    if (token.surface) return token;
  },

  tokenize: function(line, f)
  {
    ++this.line;
    this.i = 0;
    this.input = line;
    var token;
    do {
      token = this.next_token();
      if (token) this.tokens.push(token);
    } while (token);
    if (this.open.length === 0) {
      var tokens = this.tokens.slice(0);
      this.tokens = [];
      f(tokens);
    } else {
      prompt("{0} ".fmt(this.mode), (function(line_) {
          this.tokenize(line_, f)
        }).bind(this));
    }
  },
};

var l = Object.create(lexer).init();

function repl(line)
{
  l.tokenize(line, function(tokens) {
      console.log("{0}\t".fmt(l.line), tokens.map(function(t) {
          return t.type === "quoted" ? "\033[00;46m{0}\033[00m"
            .fmt(t.value || " ") : "\033[00;47m{0}\033[00m".fmt(t.value);
        }).join("  "));
      prompt("? ", repl);
    });
}

prompt("? ", repl);
