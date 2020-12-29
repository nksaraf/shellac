import {
  ExecResult,
  ParsedToken,
  ParseResult,
  ExecutionContext,
  CustomCommand,
} from "./types";
import execa from "execa";
import meow from "meow";

async function IfStatement(chunk: ParsedToken, context: ExecutionContext) {
  const { interps, last_cmd } = context;
  const [[val_type, val_id], if_clause, ...else_clause] = chunk;

  let interp = interps[Number(val_id)];
  let value = await resolveValue(interp, context);

  // @ts-ignore
  if (value) {
    // console.log("IF STATEMENT IS TRUE")
    return await execute(if_clause, context);
  } else if (else_clause.length > 0) {
    if (else_clause.length === 2) {
      let interp = interps[Number(else_clause[0][1])];
      let value = await resolveValue(interp, context);

      if (value) {
        // console.log("ELSE IF STATEMENT IS TRUE")
        return await execute(else_clause[1], context);
      } else {
        // console.log("ELSE IF STATEMENT IS FALSE")
        return;
      }
    }
    // console.log("ELSE STATEMENT")
    return await execute(else_clause[0], context);
  } else {
    return last_cmd;
  }
}

async function ForStatement(chunk: ParsedToken, context: ExecutionContext) {
  const { interps, last_cmd } = context;
  const [variable, [val_type, val_id], loop] = chunk;
  // console.log({val_type, val_id, if_clause, else_clause})

  let interp = interps[Number(val_id)];
  let values = await resolveValue(interp, context);

  if (!Array.isArray(values)) {
    throw new Error("for statement must be used with a list value");
  }

  let cmd;

  for (var i = 0; i < values.length; i++) {
    let valintrp = values[i];
    let env = {
      ...context.env,
      [variable as string]: await resolveValue(valintrp, context),
    };
    cmd = await execute(loop, {
      ...context,
      env,
      ...context.exec.in(context.cwd, { env }),
    });
  }

  return cmd;

  // @ts-ignore
  // if (interps[val_id]) {
  //   // console.log("IF STATEMENT IS TRUE")
  // } else if (else_clause) {
  //   // console.log("IF STATEMENT IS FALSE")
  //   return execute(else_clause, context);
  // } else {
  //   return last_cmd;
  // }
}

const commands: {
  [key: string]: CustomCommand;
} = {};

async function Command(chunk: ParsedToken, context: ExecutionContext) {
  const { interps, cwd } = context;
  const [str] = chunk as string[];
  // @ts-ignore
  const split_cmd = str.split(/#__(?:FUNCTION|VALUE)_(\d+)__#/g);
  let cmd = "";
  let i = 0;
  for (const token of split_cmd) {
    if (i++ % 2 === 0) {
      cmd += token;
    } else {
      // @ts-ignore
      const interp = interps[token];
      cmd += await resolveValue(interp, context);
    }
  }

  context;

  let parts = cmd.split(" ");

  const localCli = meow({ argv: parts.slice(1) });

  let env = { ...context.env, ...localCli.flags, input: localCli.input };

  if (commands[parts[0]]) {
    return await commands[parts[0]]({
      ...context,
      ...localCli,
      env: env,
      ...context.exec.in(cwd, {
        env: env,
      }),
      cmd,
    });
  }

  return await execa.command(cmd, {
    cwd,
    shell: process.env.SHELL,
    env: env as any,
    stdio: "inherit",
  });
}

async function resolveValue(interp: any, context: ExecutionContext) {
  return await (typeof interp === "function"
    ? interp({ ...context.env, cwd: context.cwd, cmd: context.cmd }, context)
    : interp);
}

async function InStatement(chunk: ParsedToken, context: ExecutionContext) {
  const { interps } = context;
  const [[val_type, val_id], in_clause] = chunk;
  if (val_type !== "VALUE")
    throw new Error(
      "IN statements only accept value interpolations, not functions."
    );

  // @ts-ignore
  const new_cwd = await resolveValue(interps[val_id], context);
  if (!new_cwd || typeof new_cwd !== "string")
    throw new Error(
      `IN statements need a string value to set as the current working dir`
    );

  return await execute(in_clause, {
    ...context,
    cwd: new_cwd,
    ...context.exec.in(new_cwd, { env: context.env }),
  });
}

async function Grammar(chunk: ParsedToken, context: ExecutionContext) {
  const { last_cmd } = context;
  let new_last_cmd = last_cmd;
  for (const sub of chunk) {
    new_last_cmd = await execute(sub, {
      ...context,
      last_cmd: new_last_cmd,
    });
  }
  return new_last_cmd;
}

async function Await(chunk: ParsedToken, context: ExecutionContext) {
  const { interps, last_cmd } = context;
  const [[val_type, val_id]] = chunk;
  if (val_type !== "FUNCTION")
    throw new Error(
      "IN statements only accept function interpolations, not values."
    );

  // @ts-ignore
  await resolveValue(interps[val_id], context);
  return last_cmd;
}

// async function Stdout(chunk: ParsedToken, context: ExecutionContext) {
//   const { interps, last_cmd, captures } = context;
//   const [out_or_err, second] = chunk;
//   if (!(out_or_err === "stdout" || out_or_err === "stderr"))
//     throw new Error(`Expected only 'stdout' or 'stderr', got: ${out_or_err}`);
//   const capture = trimFinalNewline(last_cmd?.[out_or_err] || "");
//   // @ts-ignore
//   const tag: string = second.tag;
//   if (tag === "identifier") {
//     const [val_type, val_id] = second;
//     if (val_type !== "FUNCTION")
//       throw new Error(
//         "STDOUT/STDERR statements only accept function interpolations, not values."
//       );

//     // @ts-ignore
//     await interps[val_id](capture);
//   } else if (tag === "variable_name") {
//     captures[second[0] as string] = capture;
//   } else {
//     throw new Error(
//       "STDOUT/STDERR statements expect a variable name or an interpolation function."
//     );
//   }
//   return last_cmd;
// }

export const registerCommand = (name: string, command: CustomCommand) => {
  commands[name] = command;
};

export const execute = async (
  chunk: ParseResult,
  context: ExecutionContext
): Promise<ExecResult> => {
  // console.log({ chunk })
  if (Array.isArray(chunk)) {
    if (chunk.tag === "command_line" || chunk.tag === "logged_command") {
      return await Command(chunk, context);
    } else if (chunk.tag === "if_statement") {
      return await IfStatement(chunk, context);
    } else if (chunk.tag === "if_else_statement") {
      return await IfStatement(chunk, context);
    } else if (chunk.tag === "for_statement") {
      return await ForStatement(chunk, context);
    } else if (chunk.tag === "in_statement") {
      return await InStatement(chunk, context);
    } else if (chunk.tag === "grammar") {
      return await Grammar(chunk, context);
    } else if (chunk.tag === "await_statement") {
      return await Await(chunk, context);
      // } else if (chunk.tag === "stdout_statement") {
      //   return await Stdout(chunk, context);
    } else {
      return context.last_cmd;
    }
  }

  return null;
};
