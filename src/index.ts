#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";
import { exec } from "code-alchemy/child_process";
import httpClient from "starless-http";

const args = process.argv.slice(2);
const cwd = process.cwd();
const packageJsonPath = path.join(cwd, "package.json");

const testJsonFileName =
  args[0].includes("--") || !args[0] ? "test.json" : args[0];
const testJsonFile = path.join(cwd, testJsonFileName);

const keys = [
  "toBe",
  "toEqual",
  "toBeGreaterThan",
  "toBeGreaterThanOrEqual",
  "toBeLessThan",
  "toBeLessThanOrEqual",
  "toBeCloseTo",
  "toMatch",
  "toContain",
  "toThrow",
];
const operators = [...keys, ...keys.map((key) => `not.${key}`)];

export interface TestOptions {
  type: string;
  scriptPath?: string;
  function?: string;
  expect: any;
  expectArg?: string;

  [key: string]: any;
}
export interface TestJson {
  [key: string]: TestOptions;
}

async function main() {
  const json: TestJson = await import(testJsonFile);
  let testScript = "";
  for (const [description, options] of Object.entries(json)) {
    let expectArg = "data";
    if ("expectArg" in options) {
      expectArg = options.expectArg || "data";
    }
    let operator = "toBe";
    let result = null;
    for (const key of operators) {
      if (key in options) {
        operator = key;
        result = options[key];
        break;
      }
    }

    if (options.type == "function") {
      const [fileName, functionName] = options.function.split(".");
      const funcArgs = !Array.isArray(options.expect)
        ? [options.expect]
        : options.expect;

      testScript += `
test('${description}', async () => {
    const func = require('${path.join(options.scriptPath, fileName)}')${
        functionName ? `['${functionName}']` : ""
      };
    let data = null;
    if (func.toString().includes('async') || func.toString().includes('__awaiter')) {
        data = await func(${funcArgs.join(", ")});
    } else {
        data = func(${funcArgs.join(", ")});
    }
    expect(${expectArg}).${operator}(${result});
});\n
`;
    } else if (options.type == "api") {
      const { url, method, body, query, headers } = options.expect;
      const httpClientOptions = {
        params: query || {},
        headers: headers || {},
      };
      let response = null;
      let err = null;
      if (method == "get" || method == "delete") {
        [response, err] = await httpClient[method](url, httpClientOptions);
      } else {
        [response, err] = await httpClient[method](
          url,
          body || {},
          httpClientOptions
        );
      }
      if (err) {
        if ("response" in err) {
          response = {
            status: err.response.status,
            data: err.response.data,
          };
        } else {
          response = {
            status: null,
            data: {
              message: err.message,
            },
          };
        }
      } else {
        response = {
          status: response.status,
          data: response.data,
        };
      }

      testScript += `
test('${description}', async () => {
    const data = ${JSON.stringify(response)};
    expect(${expectArg}).${operator}(${result});
});\n
`;
    }
  }
  const testJsFilePath = path.join(
    cwd,
    testJsonFileName.replace(".json", ".test.js")
  );
  fs.writeFileSync(testJsFilePath, testScript);

  let testCmd = "jest";
  if (fs.existsSync(packageJsonPath)) {
    let packageJson = await import(packageJsonPath);
    if ("scripts" in packageJson) {
      packageJson.scripts["test"] = "jest";
    } else {
      packageJson.scripts = {
        test: "jest",
      };
    }
    const newPackageJson = { ...packageJson };
    delete newPackageJson["default"];
    fs.writeFileSync(packageJsonPath, JSON.stringify(newPackageJson, null, 2));
    if (
      !(
        ("dependencies" in packageJson && "jest" in packageJson.dependencies) ||
        ("devDependencies" in packageJson &&
          "jest" in packageJson.devDependencies)
      )
    ) {
      const { stdout, stderr } = await exec("npm i -D jest", { cwd });
      console.log(stdout);
      console.log(stderr);
    }
    testCmd = "npm run test";
  }
  const { stdout, stderr } = await exec(testCmd, { cwd });
  console.log(stdout);
  console.log(stderr);

  if (args.includes("--no-testjs")) {
    fs.rmSync(testJsFilePath);
  }
}

main();
