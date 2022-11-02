#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const child_process_1 = require("code-alchemy/child_process");
const starless_http_1 = __importDefault(require("starless-http"));
const args = process.argv.slice(2);
const cwd = process.cwd();
const packageJsonPath = node_path_1.default.join(cwd, "package.json");
const testJsonFileName = args[0].includes("--") || !args[0] ? "test.json" : args[0];
const testJsonFile = node_path_1.default.join(cwd, testJsonFileName);
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
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const json = yield Promise.resolve().then(() => __importStar(require(testJsonFile)));
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
    const func = require('${node_path_1.default.join(options.scriptPath, fileName)}')${functionName ? `['${functionName}']` : ""};
    let data = null;
    if (func.toString().includes('async') || func.toString().includes('__awaiter')) {
        data = await func(${funcArgs.join(", ")});
    } else {
        data = func(${funcArgs.join(", ")});
    }
    expect(${expectArg}).${operator}(${result});
});\n
`;
            }
            else if (options.type == "api") {
                const { url, method, body, query, headers } = options.expect;
                const httpClientOptions = {
                    params: query || {},
                    headers: headers || {},
                };
                let response = null;
                let err = null;
                if (method == "get" || method == "delete") {
                    [response, err] = yield starless_http_1.default[method](url, httpClientOptions);
                }
                else {
                    [response, err] = yield starless_http_1.default[method](url, body || {}, httpClientOptions);
                }
                if (err) {
                    if ("response" in err) {
                        response = {
                            status: err.response.status,
                            data: err.response.data,
                        };
                    }
                    else {
                        response = {
                            status: null,
                            data: {
                                message: err.message,
                            },
                        };
                    }
                }
                else {
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
        const testJsFilePath = node_path_1.default.join(cwd, testJsonFileName.replace(".json", ".test.js"));
        node_fs_1.default.writeFileSync(testJsFilePath, testScript);
        let testCmd = "jest";
        if (node_fs_1.default.existsSync(packageJsonPath)) {
            let packageJson = yield Promise.resolve().then(() => __importStar(require(packageJsonPath)));
            if ("scripts" in packageJson) {
                packageJson.scripts["test"] = "jest";
            }
            else {
                packageJson.scripts = {
                    test: "jest",
                };
            }
            const newPackageJson = Object.assign({}, packageJson);
            delete newPackageJson["default"];
            node_fs_1.default.writeFileSync(packageJsonPath, JSON.stringify(newPackageJson, null, 2));
            if (!(("dependencies" in packageJson && "jest" in packageJson.dependencies) ||
                ("devDependencies" in packageJson &&
                    "jest" in packageJson.devDependencies))) {
                const { stdout, stderr } = yield (0, child_process_1.exec)("npm i -D jest", { cwd });
                console.log(stdout);
                console.log(stderr);
            }
            testCmd = "npm run test";
        }
        const { stdout, stderr } = yield (0, child_process_1.exec)(testCmd, { cwd });
        console.log(stdout);
        console.log(stderr);
        if (args.includes("--no-testjs")) {
            node_fs_1.default.rmSync(testJsFilePath);
        }
    });
}
main();
