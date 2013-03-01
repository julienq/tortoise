var rli = require("readline").createInterface(process.stdin, process.stdout);
rli.on("close", function () {
  process.stdout.write("\n");
  process.exit(0);
});

function prompt(p, f) {
  rli.setPrompt(p);
  rli.once("line", function (line) {
    f(line);
  });
  rli.prompt();
}

var logo = require("./logo.js");

logo.format_token = {
  "": function () { return "\033[00;47m%0\033[00m".fmt(this.value); },
  error: function () { return "\033[00;41m%0\033[00m".fmt(this.surface); },
  number: function () { return "\033[00;42m%0\033[00m".fmt(this.value); },
  word: function () { return "\033[00;46m%0\033[00m".fmt(this.value || " "); }
};

var tokenizer = Object.create(logo.tokenizer).init();
var parser = Object.create(logo.parser).init();

function repl(line) {
  tokenizer.tokenize(line + "\n", function (p, tokens) {
    if (tokens) {
      console.log("%0\t%1 (x%2)"
        .fmt(tokenizer.line, tokens.join(" "), tokens.length));
    }
    prompt("%0 ".fmt(p), repl);
  });
}

prompt("? ", repl);
