"use strict";

var assert = typeof require === "function" && require("chai").assert ||
  window.chai.assert;
var logo = typeof require === "function" && require("../logo.js") ||
  window.logo;

var tokenizer, parser;

describe("Tokenizer", function () {

  describe("Sanity checks", function () {
    it("logo.tokenizer is defined", function () {
      assert.isObject(logo.tokenizer);
    });
    tokenizer = Object.create(logo.tokenizer).init();
    it("new tokenizers can be created", function () {
      assert.isObject(tokenizer);
    });
  });

  describe("Whitespace and comments", function () {

    it("Whitespace-only delimiters inside lists", function (done) {
      tokenizer.tokenize("1+2[1+2]", function (p, tokens) {
        assert.strictEqual(p, "?");
        assert.strictEqual(tokens.length, 6);
        assert.strictEqual(tokens[4].type, "word");
        assert.strictEqual(tokens[4].value, "1+2");
        done();
      });
    });

    it("Comments start with ; until the end of the line", function (done) {
      tokenizer.tokenize("1 + 2 ; should equal 3", function (p, tokens) {
        assert.strictEqual(p, "?");
        assert.strictEqual(tokens.length, 3);
        done();
      });
    });

    it("Continuation line with ~", function (done) {
      tokenizer.tokenize("f~\n", function (p) {
        assert.strictEqual(p, "~");
        tokenizer.tokenize("o~\n", function (p) {
          assert.strictEqual(p, "~");
          tokenizer.tokenize("o", function (p, tokens) {
            assert.strictEqual(p, "?");
            assert.strictEqual(tokens.length, 1);
            assert.strictEqual(tokens[0].value, "FOO");
            done();
          });
        });
      });
    });

    it("Continuation line with ~ (with comment)", function (done) {
      tokenizer.tokenize("1 + 2 ;~\n", function (p) {
        assert.strictEqual(p, "~");
        tokenizer.tokenize("- 3 ; ok now", function (p, tokens) {
          assert.strictEqual(p, "?");
          assert.strictEqual(tokens.length, 5);
          done();
        });
      });
    });

    it("~ does not continue a comment", function (done) {
      tokenizer.tokenize("print \"abc;comment ~\n", function(p) {
        assert.strictEqual(p, "~");
        tokenizer.tokenize("def", function (p, tokens) {
          assert.strictEqual(p, "?");
          assert.strictEqual(tokens.length, 2);
          assert.strictEqual(tokens[1].value, "abcdef");
          assert.strictEqual(tokens[1].surface, "\"abcdef");
          done();
        });
      });
    });

    it("A line is not terminated when a list is still open", function (done) {
      tokenizer.tokenize("[foo bar baz\n", function (p) {
        assert.strictEqual(p, "[");
        tokenizer.tokenize("[fum quux\n", function (p) {
          assert.strictEqual(p, "[");
          tokenizer.tokenize("]\n", function (p) {
            assert.strictEqual(p, "[");
            tokenizer.tokenize("quuux]", function (p, tokens) {
              assert.strictEqual(p, "?");
              done();
            });
          });
        });
      });
    });

    it("Same for parens", function (done) {
      tokenizer.tokenize("(1 + 2\n", function (p) {
        assert.strictEqual(p, "(");
        tokenizer.tokenize(")", function (p) {
          assert.strictEqual(p, "?");
          done();
        });
      });
    });

  });

  describe("Token types", function () {

    it("Number: e.g., 1, 123, .05, 3.14 -17", function (done) {
      tokenizer.tokenize("1 123 .05 3.14 -17", function (p, tokens) {
        assert.strictEqual(p, "?");
        assert.strictEqual(tokens.length, 5);
        assert.strictEqual(tokens[0].value, 1);
        assert.strictEqual(tokens[1].value, 123);
        assert.strictEqual(tokens[2].value, .05);
        assert.strictEqual(tokens[3].value, 3.14);
        assert.strictEqual(tokens[4].value, -17);
        done();
      });
    });

    it("Name: e.g., foo, .EQ, 3rd? (not a number)", function (done) {
      tokenizer.tokenize("foo .EQ 3rd?", function (p, tokens) {
        assert.strictEqual(p, "?");
        assert.strictEqual(tokens.length, 3);
        assert.strictEqual(tokens[0].type, "name");
        assert.strictEqual(tokens[0].value, "FOO");
        assert.strictEqual(tokens[0].surface, "foo");
        assert.strictEqual(tokens[1].type, "name");
        assert.strictEqual(tokens[1].value, ".EQ");
        assert.strictEqual(tokens[1].surface, ".EQ");
        assert.strictEqual(tokens[2].type, "name");
        assert.strictEqual(tokens[2].value, "3RD?");
        assert.strictEqual(tokens[2].surface, "3rd?");
        done();
      });
    });

    it("Word: quoted, or in a list (e.g., \"bar, [2+3])", function (done) {
      tokenizer.tokenize("\"bar [2+3]", function (p, tokens) {
        assert.strictEqual(p, "?");
        assert.strictEqual(tokens.length, 4);
        assert.strictEqual(tokens[0].type, "word");
        assert.strictEqual(tokens[0].value, "bar");
        assert.strictEqual(tokens[0].surface, "\"bar");
        assert.strictEqual(tokens[2].type, "word");
        assert.strictEqual(tokens[2].value, "2+3");
        assert.strictEqual(tokens[2].surface, "2+3");
        done();
      });
    });

    it("Infix operator: +, -, *, /, =, <, >, <=, >=, and <>", function (done) {
      tokenizer.tokenize("+-*/=><<=>=<>", function (p, tokens) {
        assert.strictEqual(p, "?");
        assert.strictEqual(tokens.length, 10);
        assert.strictEqual(tokens[0].value, "+");
        assert.strictEqual(tokens[1].value, "-");
        assert.strictEqual(tokens[2].value, "*");
        assert.strictEqual(tokens[3].value, "/");
        assert.strictEqual(tokens[4].value, "=");
        assert.strictEqual(tokens[5].value, ">");
        assert.strictEqual(tokens[6].value, "<");
        assert.strictEqual(tokens[7].value, "<=");
        assert.strictEqual(tokens[8].value, ">=");
        assert.strictEqual(tokens[9].value, "<>");
        tokens.forEach(function (token) {
          assert.strictEqual(tokens[0].type, "infix");
        });
        done();
      });
    });

  });

  describe("Escaping", function () {

    it("Use \\ for escaping; e.g. foo\\ bar, x\\~, \\;no\\-comment", function (done) {
      tokenizer.tokenize("foo\\ bar \\;no\\-comment x\\~", function (p, tokens) {
        assert.strictEqual(p, "?");
        assert.strictEqual(tokens.length, 3);
        assert.strictEqual(tokens[0].type, "name");
        assert.strictEqual(tokens[0].value, "FOO BAR");
        assert.strictEqual(tokens[0].surface, "foo\\ bar");
        assert.strictEqual(tokens[1].type, "name");
        assert.strictEqual(tokens[1].value, ";NO-COMMENT");
        assert.strictEqual(tokens[1].surface, "\\;no\\-comment");
        assert.strictEqual(tokens[2].type, "name");
        assert.strictEqual(tokens[2].value, "X~");
        assert.strictEqual(tokens[2].surface, "x\\~");
        done();
      });
    });

    it("\\ at the end of a line escapes the following newline", function (done) {
      tokenizer.tokenize("foo\\\n", function (p, tokens) {
        assert.strictEqual(p, "\\");
        assert.strictEqual(tokens, undefined);
        tokenizer.tokenize("bar", function (p, tokens) {
          assert.strictEqual(p, "?");
          assert.strictEqual(tokens.length, 1);
          assert.strictEqual(tokens[0].type, "name");
          assert.strictEqual(tokens[0].value, "FOO\nBAR");
          assert.strictEqual(tokens[0].surface, "foo\\\nbar");
          done();
        });
      });
    });

    it("An escaped digit turns a number into a name (e.g. \\12)", function (done) {
      tokenizer.tokenize("\\12", function (p, tokens) {
        assert.strictEqual(p, "?");
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].type, "name");
        assert.strictEqual(tokens[0].value, "12");
        assert.strictEqual(tokens[0].surface, "\\12");
        done();
      });
    });

    it("Vertical bars also escape: |foo bar|, |x~|, |;no-comment|, |12|, ||", function (done) {
      tokenizer.tokenize("|foo bar| |;no-comment| |x~| |12| ||", function (p, tokens) {
        assert.strictEqual(p, "?");
        assert.strictEqual(tokens.length, 5);
        assert.strictEqual(tokens[0].type, "name");
        assert.strictEqual(tokens[0].value, "FOO BAR");
        assert.strictEqual(tokens[0].surface, "|foo bar|");
        assert.strictEqual(tokens[1].type, "name");
        assert.strictEqual(tokens[1].value, ";NO-COMMENT");
        assert.strictEqual(tokens[1].surface, "|;no-comment|");
        assert.strictEqual(tokens[2].type, "name");
        assert.strictEqual(tokens[2].value, "X~");
        assert.strictEqual(tokens[2].surface, "|x~|");
        assert.strictEqual(tokens[3].type, "name");
        assert.strictEqual(tokens[3].value, "12");
        assert.strictEqual(tokens[3].surface, "|12|");
        assert.strictEqual(tokens[4].type, "name");
        assert.strictEqual(tokens[4].value, "");
        assert.strictEqual(tokens[4].surface, "||");
        done();
      });
    });

  });

});


describe("Parser", function () {

  describe("Sanity checks", function () {
    it("logo.parser is defined", function () {
      assert.isObject(logo.parser);
    });
    parser = Object.create(logo.parser).init();
    it("new parsers can be created", function () {
      assert.isObject(parser);
    });
  });

});
