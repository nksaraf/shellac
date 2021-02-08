#!/usr/bin/env node
process.argv = process.argv.slice(1);
import fs from "fs";
import { exec } from "./index";

let firstArg = process.argv[1];

if (
  firstArg &&
  ["js", "ts", "tsx", "jsx"].includes(firstArg.split(".").pop() ?? "")
) {
  if (!fs.existsSync(firstArg)) {
    throw new Error("File not found: " + firstArg);
  }
  exec`
    $ node -r esbuild-runner/register ${firstArg} ${process.argv
    .slice(2)
    .join(" ")}
  `;
} else {
  exec`
  $ node -r esbuild-runner/register ${
    fs.existsSync("scripts.ts") ? "scripts.ts" : "scripts.js"
  } ${process.argv.slice(1).join(" ")}
`;
}
