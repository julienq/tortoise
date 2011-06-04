Function.prototype.tail = function()
{
  return [this, arguments];
};

Function.prototype.tco = function()
{
  var c = [this, arguments];
  var esc = arguments[arguments.length - 1];
  while (c[0] !== esc) c = c[0].apply(this, c[1]);
  return esc.apply(this, c[1]);
};

function id(x) { return x; }

var token_stream =
{
  init: function(str)
  {
    this.consumed = "";
    this.value = str;
    return this;
  },

  // Consume the input matching rx and return true if there was a match
  // rx must be anchored!
  consume: function(rx)
  {
    var m = this.value.match(rx);
    if (m) {
      var l = m[0].length;
      this.consumed += this.value.substr(0, l);
      this.value = this.value.substr(l);
    }
    return m;
  },
};

// Eval a token stream
function eval_stream(stream, k)
{
  var m = stream.consume(/^\s+/);
  if (!stream.value.length) {
    console.log("eval_string: empty stream");
    return k.tail();
  }
  if (m = stream.consume(/^"((?:[^\s\[\]\(\);\\]|(?:\\.))*)/)) {
    console.log("got token: quoted " + m[0]);
    return eval_quoted.tail(m[1], k);
  } else if (m = stream
      .consume(/^((\d+(\.\d*)?)|(\d*\.\d+))(?=[\s\[\]\(\)+\-*\/=<>;]|$)/)) {
    console.log("got token: number " + m[0]);
    return eval_number.tail(m[0], k);
  } else if (m = stream
      .consume(/^(:?)((?:[^\s\[\]\(\)+\-*\/=<>;\\]|(?:\\.))+)/)) {
    console.log("got token: word " + m[0]);
    return eval_word.tail(m[0], stream, k);
  }
}

function eval_number(n, k)
{
  var val = parseFloat(n);
  console.log("eval_number: " + val);
  return k.tail(val);
}

function eval_quoted(q, k)
{
  var val = q.replace(/\\(.)/g, "$1");
  console.log("eval_quoted: " + val);
  return k.tail(val);
}

function eval_word(w, stream, k)
{
  var val = w.replace(/\\(.)/g, "$1").toUpperCase();
  var f = WORDS[val];
  console.log("eval_word: " + val + "(" + stream.value + ")");
  return f.tail(stream, k);
}

WORDS =
{
  COUNT: function(stream, k)
  {
    return eval_stream.tail(stream, function(thing) {
        console.log("COUNT(" + thing + ") = " + thing.length);
        return k.tail(thing.length);
      });
  },

  MINUS: function(stream, k)
  {
    return eval_stream.tail(stream, function(n) {
        console.log("MINUS(" + n.toString() + ") = " + (-n));
        return k.tail(-n);
      });
  },

  SUM: function(stream, k)
  {
    return eval_stream.tail(stream, function(n) {
        console.log("SUM(" + n.toString() + ", ???)");
        return eval_stream.tail(stream, function(m) {
            console.log("SUM(" + n.toString() + ", " + m.toString() + " = " +
              (n + m).toString());
            return k.tail(n + m);
          });
      });
  },
};

function eval_string(str)
{
  return eval_stream.tco(Object.create(token_stream).init(str), id);
}


console.log("longer > got value: " + eval_string('sum minus count "foo 5') + "\n");
console.log("numbers > got value: " + eval_string('2 3 4 5') + "\n");
console.log("quoted > got value: " + eval_string('"he\\llo') + "\n");
console.log("number > got value: " + eval_string('  23 ') + "\n");
console.log("arity > got value: " + eval_string('sum 2 3 4 5') + "\n");
console.log("words > got value: " + eval_string('minus count "foo') + "\n");
console.log("word > got value: " + eval_string('count "foo') + "\n");
