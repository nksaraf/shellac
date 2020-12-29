#!/usr/bin/env node
process.argv = process.argv.slice(1);
import fs from "fs";
import { exec } from "./index";

let firstArg = process.argv[1];

if (firstArg && (firstArg.endsWith(".js") || firstArg.endsWith(".ts"))) {
  if (!fs.existsSync(firstArg)) {
    throw new Error("File not found: " + firstArg);
  }
  exec`
    $ sucrase-node ${firstArg} ${process.argv.slice(2).join(" ")}
  `;
} else {
  exec`
  $ sucrase-node ${
    fs.existsSync("scripts.ts") ? "scripts.ts" : "scripts.js"
  } ${process.argv.slice(1).join(" ")}
`;
}
