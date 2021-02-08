import { kush, run } from "./src";

kush`
build-pkg:
  $ tsup ${($) => $.input.join(" ")} --out-dir=./dist --dts ${($) =>
  $.minify && "--minify"}

build:
  $ echo $ABCD
  $ rm -rf dist
  $ babel src/parser.js -d lib
  $ build-pkg src/cli.ts src/index.ts --minify

build-all:
  $ echo $ABCD

noop: $ echo 12
`({});
