export type ShellacValueInterpolation =
  | string
  | boolean
  | undefined
  | number
  | null;

import meow from "meow";
export type ShellacInterpolations =
  | ShellacValueInterpolation
  | Promise<ShellacValueInterpolation>
  | (($: Env, context: ExecutionContext) => void)
  | (($: Env, context: ExecutionContext) => Promise<void>)
  | ((
      $: Env,
      context: ExecutionContext
    ) => Promise<void | ShellacValueInterpolation>);

export type ShellacReturnVal = {
  stdout: string;
  stderr: string;
  [key: string]: string;
};
export type ParsedToken = Array<ParseResult> & { tag: string };
export type ParseResult = string | ParsedToken;
export type Parser = (str: string) => undefined | ParseResult;
export type ExecResult = any;
export type Captures = { [key: string]: string };

export type Shell = {
  exec: ShellacImpl;
  sh: Script;
};
export type ShellacImpl = ((
  s: TemplateStringsArray,
  ...interps: ShellacInterpolations[]
) => Promise<void>) & {
  in: (cwd: string, options: { env: Env }) => Shell;
  getSh: () => Script;
};

export interface Script {
  (
    s: TemplateStringsArray,
    ...args: ShellacInterpolations[]
  ): () => Promise<void>;
}

export type Env = { [key: string]: any };

export interface ExecutionContext extends meow.Result<meow.AnyFlags>, Shell {
  interps: (ShellacInterpolations | ShellacInterpolations[])[];
  last_cmd: ExecResult;
  cwd: string;
  env: Env;
  captures: Captures;
  cmd?: ParseResult;
}

export type CustomCommand = (context: ExecutionContext) => Promise<void> | void;
