// HTML REPL for Logo

var out = document.getElementById("out_");
var cmdline = document.getElementById("cmdline");

var lines = [];

// Prompt for a single line of input
logo.prompt_raw = function(p, f)
{
  if (lines.length > 0) {
    f(lines.shift());
  } else {
    function read_once(e)
    {
      if (e.keyCode === 13) {
        cmdline.removeEventListener("keydown", read_once, false);
        e.preventDefault();
        var input = cmdline.value;
        cmdline.value = "";
        logo.print(input, "cmd");
        f(input);
      }
    }
    // logo.print(p);
    cmdline.addEventListener("keydown", read_once, false);
  }
};

// Print to the console element with an additional class
logo.print = function(str, c)
{
  str.split("\n").forEach(function(x) {
      if (c) {
        out.appendChild(populus.html("span", { "class": c }, x));
      } else {
        out.append_text(x);
      }
      out.appendChild(populus.html("br"));
    });
  // Scroll down so that the bottom is always visible
  out.parentNode.scrollTop = out.offsetHeight;
};

// Node-specific implementation of warn for Logo
logo.warn = function(warning)
{
  logo.print("Warning #{0}: {1}".fmt(warning.error_code, warning.message),
      "warning");
};

function eval_input(input, f)
{
  lines = input.split("\n");
  (function eval() {
    if (lines.length > 0) {
      logo.eval_input(lines.shift(), function(error, value) {
        if (error) {
          logo.print("Error #{0}: {1}"
            .fmt(error.error_code, error.message), "error");
        }
        eval();
      });
    } else {
      f();
    }
  })();
}

function eval_script(url, f)
{
  populus.xhr(url, {}, "", function(req) {
    if (req.status === 200 || req.status === 0) {
      eval_input(req.responseText, f);
    } else {
      populus.log("XMLHttpRequest returned status {0}", req.status);
      f();
    }
  });
}

logo.init_canvas_turtle(document.getElementById("canvas_bg"),
  document.getElementById("canvas_fg"),
  document.getElementById("canvas_active"));

function repl()
{
  for (var p in logo.procedures) logo.procedures[p].primitive = true;
  cmdline.focus();
  (function eval(error, value)
  {
    if (error) {
      if (error.error_code) {
        logo.print("Error #{0}: {1}".fmt(error.error_code, error.message),
          "error");
      } else {
        throw error;
      }
    }
    logo.eval_line(eval);
  })();
}

var scripts = ["library.logo", "turtle.logo"];
(function eval_scripts()
{
  if (scripts.length > 0) {
    eval_script(scripts.shift(), eval_scripts);
  } else {
    repl();
  }
})();
