import { command, subcommands, positional, option, string, flag, run } from "cmd-ts";
import deployCmd from './commands/deploy';
import envCmd from './commands/env';

let json = flag({
    long: 'json',
    short: 'j',
});

const deploy = command({
    name: 'promote',
    description: 'promotes an environment by replaying its upgrade script and triggering a sign of the transaction.',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        json,
    },
    handler: deployCmd,
});

const env = command({
    name: 'env',
    description: 'list important information about an environment',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        json,
    },
    handler: envCmd,
});

const zeus = subcommands({
    name: 'zeus',
    cmds: { deploy, env },
});

run(zeus, process.argv.slice(2));