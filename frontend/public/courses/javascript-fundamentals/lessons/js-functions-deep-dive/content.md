# Functions, deeper

You can already write a function. Now we go one floor down: in JavaScript, **functions are values**. You can store them in variables, pass them to other functions, and even return them from functions. That last sentence sounds abstract; once you see it, it unlocks everything in the next lesson (where arrays use functions for `.map`, `.filter`, etc.).

## What you'll learn

- Functions are values you can hand around — like a number or a string
- The arrow form `(x) => x + 1` and how it relates to `function (x) { return x + 1 }`
- How to pass a function to another function (a **callback**)
- How a function can remember a value from where it was defined (a **closure**)

## Instructions

Write a function `applyTwice(f, x)` that calls `f` on `x`, then calls `f` again on the result, and returns the final value.

Examples:

- `applyTwice(n => n + 3, 10)` → `16`  (10 → 13 → 16)
- `applyTwice(s => s + "!", "hi")` → `"hi!!"`  ("hi" → "hi!" → "hi!!")
- `applyTwice(n => n * 2, 3)` → `12`  (3 → 6 → 12)

The key thing: the first parameter is *another function*. You don't write `if`s for what to do — whoever calls `applyTwice` decides what to do, and you just apply it twice.

## Key concepts

### Functions are values

This is the unlock. A function is a value, just like `5` or `"hello"`. You can put one in a variable:

```javascript
const greet = function (name) {
  return "Hello, " + name;
};

greet("Ada");  // "Hello, Ada"
```

`greet` is a variable that *points at a function*. Calling `greet("Ada")` runs the function it points at. This shape — `const x = function ...` — is called a **function expression**, in contrast to the **function declaration** form (`function x(...) { ... }`) you've been writing. Both work; pick whichever reads cleaner.

### Arrow functions

There's a shorter way to write a function expression — the **arrow function**:

```javascript
const greet = (name) => {
  return "Hello, " + name;
};
```

And when the body is a single expression, you can drop the braces and the `return`:

```javascript
const greet = (name) => "Hello, " + name;
```

These three forms are equivalent for our purposes. Arrows are not magic — they're just less typing for the common case. (Heads-up for later: arrows handle a thing called `this` differently from `function`; you won't hit it in this course but it'll matter when you start writing classes.)

### Passing a function as an argument

If a function is a value, you can pass it like any other:

```javascript
function call(fn, x) {
  return fn(x);
}

call((n) => n + 1, 5);  // 6
call((n) => n * n, 5);  // 25
```

The function we pass in is called a **callback**. You'll see this everywhere — array methods (next lesson), event handlers, async code.

### Closures: a function that remembers

Look at this carefully:

```javascript
function makeGreeter(prefix) {
  return (name) => prefix + ", " + name;
}

const hello = makeGreeter("Hello");
const hey   = makeGreeter("Hey");

hello("Ada");  // "Hello, Ada"
hey("Ada");    // "Hey, Ada"
```

`hello` and `hey` are two separate functions, each *remembering* a different `prefix`. That memory is called a **closure**: the inner function "closed over" the variable from where it was defined. JavaScript holds onto that variable for as long as the inner function exists.

You don't need a class for this. You don't need a global. You just return a function from a function.

## A small note on the test code

A few of the tests use a pattern like `(() => { ... })()` — that's an **arrow function created and called immediately**. You don't need to write any of these yourself; we're just using them in tests to set up small scenarios (like declaring a fresh counter variable). When you read a failing test, mentally treat the contents of the outer `(() => { ... })()` as a setup block.

## Hints

1. `applyTwice` calls `f` and uses what `f` returned. So one line is `const first = f(x);` and another is `f(first)`.
2. You don't need `if` or `for` or anything fancy — just call `f` twice.
3. `function applyTwice(f, x) { return f(f(x)); }`
