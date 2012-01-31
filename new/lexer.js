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
    return this;
  },

  // TODO really read character by character to handle ~, |, ", etc. properly
  next_token: function()
  {
    if (this.mode !== "\"") this.input = this.input.replace(/^\s+/, "");
    var m;
    if (this.mode === "" || this.mode === "(" || this.mode === "{") {
      if (this.input[0] === "\"") {
        this.open.push(this.mode);
        this.mode = "\"";
        this.input = this.input.substr(1);
        return this.next_token();
      } else if (this.input[0] === "<") {
        if (this.input[1] === ">") {
          this.input = this.input.substr(2);
          return { line: this.line, surface: "<>", value: "<>",
            type: "infix" };
        } else if (this.input[1] === "=") {
          this.input = this.input.substr(2);
          return { line: this.line, surface: "<=", value: "<=", type: "infix" };
        } else {
          this.input = this.input.substr(1);
          return { line: this.line, surface: "<", value: "<", type: "infix" };
        }
      } else if (this.input[0] === ">") {
        if (this.input[1] === "=") {
          this.input = this.input.substr(2);
          return { line: this.line, surface: ">=", value: ">=", type: "infix" };
        } else {
          this.input = this.input.substr(1);
          return { line: this.line, surface: ">", value: ">", type: "infix" };
        }
      } else if (this.input[0] === "+" || this.input[0] === "-" ||
          this.input[0] === "*" || this.input[0] === "/" ||
          this.input[0] === "=") {
        this.input = this.input.substr(1);
        return { line: this.line, surface: this.input[0], value: this.input[0],
          type: "infix" };
      } else if (this.input[0] === "[") {
        this.open.push(this.mode);
        this.mode = "[";
        this.input = this.input.substr(1);
        return { line: this.line, surface: "[", value: "[", type: "[" };
      } else if (this.input[0] === "]") {
        throw "Unmatched \"]\"";
      } else if (this.input[0] === "(") {
        this.open.push(this.mode);
        this.mode = "(";
        this.input = this.input.substr(1);
        return { line: this.line, surface: "(", value: "(", type: "(" };
      } else if (this.input[0] === ")") {
        if (this.mode === "(") {
          this.mode = this.open.pop();
          this.input = this.input.substr(1);
          return { line: this.line, surface: ")", value: ")", type: ")" };
        } else {
          throw "Unmatched \")\"";
        }
      } else if (this.input[0] === "{") {
        this.open.push(this.mode);
        this.mode = "{";
        this.input = this.input.substr(1);
        return { line: this.line, surface: "{", value: "{", type: "{" };
      } else if (this.input[0] === "}") {
        if (this.mode === "{") {
          this.mode = this.open.pop();
          this.input = this.input.substr(1);
          return { line: this.line, surface: "}", value: "}", type: "}" };
        } else {
          throw "Unmatched \"}\"";
        }
      } else if (m = this.input.match(/^[^\s\[\]\(\)\{\}\+\-\*\/=<>]+/)) {
        this.input = this.input.substr(m[0].length);
        return { line: this.line, surface: m[0], value: m[0].toUpperCase(),
          type: "word" };
      }
    } else if (this.mode === "[") {
      if (m = this.input.match(/^[^\s\[\]]+/)) {
        this.input = this.input.substr(m[0].length);
        return { line: this.line, surface: m[0], value: m[0].toUpperCase(),
          type: "word" };
      } else if (this.input[0] === "[") {
        this.open.push(this.mode);
        this.mode = "[";
        this.input = this.input.substr(1);
        return { line: this.line, surface: "[", value: "[", type: "[" };
      } else if (this.input[0] === "]") {
        this.mode = this.open.pop();
        this.input = this.input.substr(1);
        return { line: this.line, surface: "]", value: "]", type: "]" };
      }
    } else if (this.mode === "\"") {
      if (m = this.input.match(/^[^\s\[\]\(\)]*/)) {
        this.mode = this.open.pop();
        this.input = this.input.substr(m[0].length);
        return { line: this.line, surface: "\"" + m[0], value: m[0],
          type: "quoted" };
      }
    }
  },

  tokenize: function(line, f)
  {
    ++this.line;
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
