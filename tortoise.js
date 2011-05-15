// Node REPL for Logo

var fs = require("fs");
var rl = require("readline");
var populus = require("populus");
var logo = require("logo");

var LIB = "./library.logo";
var PROMPT = { eval: "? ", cont: "~ ", define: "> ", logo: "" };
var MODE = "eval";
var RLI = null;

// Line being read (in case of ~ it will span several calls to eval_line)
var current_line = "";

// Eval one line of input; remove comments and ~ before passing the input line
// to be evaled (so that the tokenizer does not have to deal with comments.) In
// case of a line ending with ~, read the next line before continuing.
function eval_line(line)
{
  var m = line.match(/~$/);
  if (m) line = line.substr(0, m.index);
  current_line += line.replace(/(^|[^\\]);.*$/, "$1");
  if (m) {
    if (RLI){
      RLI.setPrompt(PROMPT.cont);
      RLI.prompt();
    }
  } else {
    logo[MODE === "eval" ? "eval_input" : "read_def"](current_line,
      function(error, eval_mode) {
        if (error) {
          MODE = "eval";
          if (error.error_code) {
            console.log("Error #{0}: {1}".fmt(error.error_code, error.message));
          } else {
            throw error;
          }
        } else {
          MODE = eval_mode ? "eval" : "define";
        }
        current_line = "";
        if (RLI) {
          RLI.setPrompt(PROMPT[MODE]);
          RLI.prompt();
        }
      });
  }
}

// Close the session
// TODO if there is input, just discard it; if there is no input, actually quit
function close()
{
  process.stdout.write("\n");
  process.exit();
}

// Quit the REPL
logo.procedures.BYE = function() { process.exit(); };

// Node-specific implementation of print for Logo
logo.print = function(str) { process.stdout.write(str + "\n"); };

// Node-specific implementation of warn for Logo
logo.warn = function(warning)
{
  process.stderr.write("Warning #{0}: {1}\n".fmt(warning.error_code,
        warning.message));
};

// Node-specific implemenation of read for use by READLIST (and others later.)
// Read one line of input and call the continuation with the read line.
logo.read = function(f)
{
  RLI.removeListener("line", eval_line);
  RLI.once("line", function(line) {
      RLI.on("line", eval_line);
      f(line);
    })
  RLI.setPrompt(PROMPT.logo);
  RLI.prompt();
};

// Read the library file (split line by line) then start prompting the user for
// commands to execute
fs.readFile(LIB, "utf8", function(error, data) {
    if (error) throw error;
    data.split("\n").forEach(eval_line);
    for (var p in logo.procedures) logo.procedures[p].primitive = true;
    process.stdin.resume;
    RLI = rl.createInterface(process.stdin, process.stdout);
    RLI.setPrompt(PROMPT[MODE]);
    RLI.on("line", eval_line);
    RLI.on("close", close);
    RLI.prompt();
  });
