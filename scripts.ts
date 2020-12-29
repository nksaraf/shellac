import { nsh, run } from "./src";

nsh`
build-pkg:
  $ yarn tsup ${($) => $.input.join(" ")} --out-dir=./dist --dts ${($) =>
  $.minify && "--minify"}

build:
  $ echo $ABCD
  $ rm -rf dist
  $ babel src/parser.js -d lib
  $ yarn nsh build-pkg src/cli.ts src/index.ts --minify

build-all:
  $ echo $ABCD

noop: $ echo 12
`;
