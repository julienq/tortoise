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
var interpreter = Object.create(logo.interpreter).init();
interpreter.print = function(str) { process.stdout.write(str + "\n"); };
interpreter.type = function(str) { process.stdout.write(str); };
interpreter.warn = function(str) { process.stderr.write(str + "\n"); };
interpreter.error = function(str) { process.stderr.write(str + "\n"); };
interpreter.bye = function() { process.exit(0); };

function repl(line)
{
  tokenizer.tokenize(line + "\n", function(p, tokens) {
      if (tokens) interpreter.eval_tokens(tokens);
      prompt("{0} ".fmt(p), repl);
    });
}

prompt("? ", repl);
