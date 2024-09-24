import { command, subcommands, run } from "cmd-ts";
import deploy from './commands/deploy/deploy';
import env from './commands/env/env';
import upgrade from './commands/upgrade/upgrade';

const zeus = subcommands({
    name: 'zeus',
    cmds: { deploy, env, upgrade },
});

run(zeus, process.argv.slice(2));