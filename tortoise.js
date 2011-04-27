
var fs = require("fs");
var rl = require("readline");
var logo = require("./logo");

var LIB = "./library.logo";
var PROMPT = { eval: "? ", cont: "~ ", define: "> ", logo: "" };
var MODE = "eval";
var RLI = null;

logo.procedures.BYE = function() { process.exit(); };

var current_line = "";

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

logo.read = function(f)
{
  MODE = "logo";
  continuation = f;
  RLI.removeListener("line", eval_line);
  RLI.once("line", function(line) {
      f(line);
      RLI.on("line", eval_line);
    })
  RLI.setPrompt(PROMPT["logo"]);
  RLI.prompt();
};

process.stdin.resume;
RLI = rl.createInterface(process.stdin, process.stdout);
RLI.setPrompt(PROMPT[MODE]);
RLI.on("line", eval_line);
RLI.prompt();

/*
fs.readFile(LIB, "utf8", function(error, data) {
    if (error) throw error;
    data.split("\n").forEach(eval_line);
    process.stdin.resume;
    RLI = rl.createInterface(process.stdin, process.stdout);
    RLI.setPrompt(PROMPT[MODE]);
    RLI.on("line", eval_line);
    RLI.prompt();
  });
  */
