/* NOTE: IMPORTING LIB WHICH IS COMPILED WITH REGHEX */
// @ts-ignore
import _parser, { parseScript as _parseScript } from "../lib/parser";
import {
  Captures,
  CustomCommand,
  Parser,
  ParseResult,
  Script,
  Shell,
  ShellacImpl,
  ShellacInterpolations,
} from "./types";
import { execute, registerCommand } from "./execute";
import meow from "meow";
import path from "path";

const globalCli = meow({});

require("dotenv").config({
  path: globalCli.flags.envFile ? globalCli.flags.envFile : ".env",
});

export const parser = (str: string) => (_parser as Parser)(str.trim());

export const logAST = (chunk: ParseResult, depth = 0, solo = false): string => {
  if (!chunk) return "";

  if (Array.isArray(chunk) && chunk.tag) {
    const indent = `${" ".repeat(depth)}`;
    const newline = `${depth === 0 ? "" : "\n"}`;
    return `${newline}${indent}${chunk.tag + ":"}${chunk
      .map((each) => logAST(each, depth + 2, chunk.length === 1))
      .join("")}`;
  } else {
    const indent = solo ? "" : "\n" + " ".repeat(depth);
    return `${indent} ${(chunk as string).trim()}`;
  }
};

export function createShell(
  cwd: string,
  {
    env = {
      ...process.env,
      ...globalCli.flags,
      input: globalCli.input,
      PATH: process.env.PATH + ":" + path.join(cwd, "node_modules", ".bin"),
    },
  }: any = {}
): Shell {
  const exec: any = Object.assign(
    (async (s, ...interps) => {
      let parsed = resolveTemplate(s, interps, parser);
      return await execute(parsed, {
        interps,
        last_cmd: null,
        cwd,
        exec,
        sh: createSh(exec),
        env,
        ...globalCli,
        captures: {},
      });
    }) as ShellacImpl,
    {
      in: (cwd: string, { env: _env }: any = {}) =>
        createShell(cwd, { env: _env ?? env }),
    }
  );

  return { exec, sh: createSh(exec) };
}

export const createSh = (exec: ShellacImpl): Script => (s, ...args) => {
  return async () => {
    await exec(s, ...args);
  };
};

const shell = createShell(process.cwd());

const exec = shell.exec;
const sh = shell.sh;

export { shell, exec, sh };

export const run = (
  getScripts: (
    sh: Script,
    exec: ShellacImpl
  ) => { [key: string]: () => Promise<void> },
  localCli = globalCli
) => {
  const { exec, sh } = createShell(process.cwd(), {
    env: {
      ...process.env,
      ...globalCli.flags,
      input: globalCli.input.slice(1),
      PATH:
        process.env.PATH +
        ":" +
        path.join(process.cwd(), "node_modules", ".bin"),
    },
  });

  const scripts = getScripts(sh, exec);
  if (!localCli.input.length) {
    console.log("No script specified, running", Object.keys(scripts)[0]);
    scripts[Object.keys(scripts)[0]]();
  } else if (scripts[localCli.input[0]]) {
    scripts[localCli.input[0]]();
  } else {
    console.log(
      "Invalid script specified. Choose one of:",
      Object.keys(scripts).join(", ")
    );
  }
};

export const parseScript = (str: string) =>
  (_parseScript as Parser)(str.trim());

export const scriptTag = async (
  s: TemplateStringsArray,
  ...interps: ShellacInterpolations[]
) => {
  let parsed = resolveTemplate(s, interps, parseScript);
  let tasks = parsed;
  let env = {
    ...process.env,
    ...globalCli.flags,
    input: globalCli.input.slice(1),
    PATH:
      process.env.PATH + ":" + path.join(process.cwd(), "node_modules", ".bin"),
  };
  const { exec, sh } = createShell(process.cwd(), {
    env,
  });

  let task = tasks.find((task: any) => task[0] === globalCli.input[0]);

  if (task) {
    return await execute(task[1], {
      interps,
      last_cmd: null,
      cwd: process.cwd(),
      exec,
      sh,
      env,
      ...globalCli,
      captures: {},
    });
  } else {
    console.log(
      "Couldnt find script to run. Use one of following: ",
      tasks.map((t: any) => t[0]).join(", ")
    );
  }
};

export const nsh = scriptTag;

export const setup = (commands: Record<string, CustomCommand>) => {
  Object.keys(commands).forEach((comm) => {
    registerCommand(comm, commands[comm]);
  });
};

export * from "./execute";

export default exec;

function resolveTemplate(
  s: TemplateStringsArray,
  interps: ShellacInterpolations[],
  parser: any
) {
  let str = s[0];

  for (let i = 0; i < interps.length; i++) {
    const is_fn = typeof interps[i] === "function";
    const interp_placeholder = `#__${is_fn ? "FUNCTION_" : "VALUE_"}${i}__#`;
    str += interp_placeholder + s[i + 1];
  }

  if (str.length === 0) throw new Error("Must provide statements");

  const parsed = parser(str);
  if (!parsed || typeof parsed === "string") throw new Error("Parsing error!");

  process.env.DEBUG &&
    console.log(
      "\n\n############ PARSED SCRIPT ###################\n" + logAST(parsed),
      "\ninterps: " +
        interps +
        "\n############ PARSED SCRIPT ###################\n\n"
    );

  return parsed;
}
