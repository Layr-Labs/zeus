import { command, subcommands, positional, option, string, flag, run } from "cmd-ts";

const deploy = command({
    name: 'promote',
    description: 'promotes an environment by replaying its upgrade script and triggering a sign of the transaction.',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        message: option({
            long: 'greeting',
            type: string,
        }),
    },
    handler: (args) => {
        console.log(args);
    },
});

const env = command({
    name: 'env',
    description: 'list important information about an environment',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        json: flag({
            long: 'json',
            short: 'j',
        }),
    },
    handler: (args) => {
        console.log(args);
    },
});

const zeus = subcommands({
    name: 'zeus',
    cmds: { deploy, env },
});

run(zeus, process.argv.slice(2));