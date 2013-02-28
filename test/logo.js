"use strict";

var assert = typeof require === "function" && require("chai").assert ||
  window.chai.assert;
var logo = typeof require === "function" && require("../logo.js") ||
  window.logo;

describe("Tokenizer", function () {

  var tokenizer;

  describe("Sanity checks", function () {
    it("logo.tokenizer is defined", function () {
      assert.isObject(logo.tokenizer);
    });
    tokenizer = Object.create(logo.tokenizer).init();
    it("new tokenizers can be created", function () {
      assert.isObject(tokenizer);
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

    it("Infix operator: +, -, *, /, =, <, >, and <>", function (done) {
      tokenizer.tokenize("+-*/=< > <>", function (p, tokens) {
        assert.strictEqual(p, "?");
        assert.strictEqual(tokens.length, 8);
        assert.strictEqual(tokens[0].value, "+");
        assert.strictEqual(tokens[1].value, "-");
        assert.strictEqual(tokens[2].value, "*");
        assert.strictEqual(tokens[3].value, "/");
        assert.strictEqual(tokens[4].value, "=");
        assert.strictEqual(tokens[5].value, "<");
        assert.strictEqual(tokens[6].value, ">");
        assert.strictEqual(tokens[7].value, "<>");
        tokens.forEach(function (token) {
          assert.strictEqual(tokens[0].type, "infix");
        });
        done();
      });
    });

  });

});
