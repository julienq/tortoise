/* Copyright © 2011, Julien Quint <julien@igel.co.jp>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *   • Redistributions of source code must retain the above copyright notice,
 *     this list of conditions and the following disclaimer.
 *   • Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *   • Neither the name of romulusetrem.us nor the names of its contributors
 *     may be used to endorse or promote products derived from this software
 *     without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE. */


var fs = require("fs");
var rl = require("readline");
var logo = require("./logo");

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

// Quit the REPL
logo.procedures.BYE = function() { process.exit(); };

logo.print = function(str) { process.stdout.write(str + "\n"); };

logo.warn = function(warning)
{
  process.stderr.write("Warning #{0}: {1}\n".fmt(warning.error_code,
        warning.message));
};

// Read one line of input and call the continuation with the read line. This is
// used by READLIST for instance.
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
    process.stdin.resume;
    RLI = rl.createInterface(process.stdin, process.stdout);
    RLI.setPrompt(PROMPT[MODE]);
    RLI.on("line", eval_line);
    RLI.prompt();
  });
