#!/usr/bin/env node

import { subcommands, run } from "cmd-ts";
import deploy from './commands/deploy/deploy.js';
import env from './commands/env/env.js';
import upgrade from './commands/upgrade/upgrade.js';
import chalk from 'chalk';
import login from './commands/login/login.js';

const main = () => {
    const zeusHost = process.env.ZEUS_HOST;
    const zeus = subcommands({
        name: 'zeus',
        description: `
        $ZEUS_HOST: ${zeusHost ? chalk.green(zeusHost) : chalk.red('<unset>')}
        `,
        cmds: { deploy, env, upgrade, login },
    });
    run(zeus, process.argv.slice(2));
}

main();