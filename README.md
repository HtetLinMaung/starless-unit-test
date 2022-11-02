# Starless Unit Test

Command Line Unit Testing tool.

## Installation

```
npm install -g starless-unit-test
```

## Getting Started

Let's get started by writing a test for a hypothetical function that adds two numbers. First, create a `calculator.js` file under `utils` folder:

```js
function sum(a, b) {
  return a + b;
}

exports.sum = sum;
```

Then, create a file named `calculator.json`. This will contain our actual test:

```json
{
  "adds 1 + 2 to equal 3": {
    "type": "function",
    "scriptPath": "./utils",
    "function": "calculator.sum",
    "expect": [1, 2],
    "toBe": 3
  }
}
```

Finally, run `starless-unit-test calculator.json` and it will print this message:

```
PASS  ./calculator.test.js
✓ adds 1 + 2 to equal 3 (5ms)
```

<b>You just successfully wrote your first test using Starless Unit Test program!</b>

## API Test

You can also test for api endpoints. Response format for api is like this `{data: {}, status: 200}`. That's why we add `expectArg` to `data.data`.

```json
{
  "adds 1 + 2 to equal 3": {
    "type": "api",
    "expect": {
      "url": "http://localhost:3000/sum",
      "method": "post"
      "body": {
        "a": 1,
        "b": 2
      }
    },
    "expectArg": "data.data",
    "toBe": 3
  }
}
```

## More Resources

Jest is internally used for unit testing. You can see more at [Jest](https://jestjs.io/)
.
