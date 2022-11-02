#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";
import { exec } from "code-alchemy/child_process";
import httpClient from "starless-http";
// import isModuleExisted from "./utils/is-module-existed";
import puppeteer from "puppeteer";

const args = process.argv.slice(2);
const cwd = process.cwd();
const packageJsonPath = path.join(cwd, "package.json");

const testJsonFileName =
  !args.length || !args[0] || args[0].includes("--") ? "test.json" : args[0];
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
  let browser: puppeteer.Browser = null;
  let page: puppeteer.Page = null;

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
    } else if (options.type == "browser") {
      if (!browser) {
        browser = await puppeteer.launch({
          timeout: 0,
          headless: args.includes("--headless"),
          // args: ["--no-sandbox", "--disable-setuid-sandbox"],
          defaultViewport: null,
        });
        page = await browser.newPage();
      }

      let data: any = null;
      for (const step of options.expect) {
        data = await page[step.action](...step.args.map((arg) => eval(arg)));
      }

      let dataStr = "null";
      if (typeof data == "object") {
        dataStr = JSON.stringify(data);
      } else if (typeof data == "string") {
        dataStr = `'${data}'`;
      } else {
        dataStr = data || null;
      }
      testScript += `
test('${description}', async () => {
    const data = ${dataStr};
    expect(${expectArg}).${operator}(${result});
});\n
`;
    }
  }
  if (browser) {
    await browser.close();
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
