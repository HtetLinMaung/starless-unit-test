#!/usr/bin/env node
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
