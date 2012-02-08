var readline = require("readline");
var flexo = require("flexo");
var logo = require("logo");

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

var tokenizer = Object.create(logo.tokenizer).init();

function repl(line)
{
  tokenizer.tokenize(line + "\n", function(p, tokens) {
      if (tokens) {
        console.log("{0}\t{1} (x{2})"
          .fmt(tokenizer.line, tokens.join(" "), tokens.length));
      }
      prompt("{0} ".fmt(p), repl);
    });
}

prompt("? ", repl);
