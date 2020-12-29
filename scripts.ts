import { run } from "./src";

run((sh) => ({
  buildEntry: sh` 
    $ yarn tsup ${($) => $.input.join(" ")} --out-dir=./dist --dts ${($) => {
    console.log($.minify);
    return $.minify ? "--minify" : "";
  }}`,
  build: sh` 
    $ echo $ABCD
    $ rm -rf dist
    $ babel src/parser.js -d lib
    $ yarn nsh buildEntry src/cli.ts src/index.ts --minify
  `,
}));
