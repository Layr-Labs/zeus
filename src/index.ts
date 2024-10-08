#!/usr/bin/env node

import { subcommands, run } from "cmd-ts";
import deploy from './commands/deploy/deploy.js';
import env from './commands/env/env.js';
import upgrade from './commands/upgrade/upgrade.js';
import chalk from 'chalk';
import login from './commands/login/login.js';
import { load } from "./commands/inject.js";
import runCmd from './commands/run.js';
import testCmd from './commands/test.js';
import initCmd from './commands/init.js';

const main = async () => {
    const zeusHost = process.env.ZEUS_HOST;
    const isLoggedIn = await load()
    const zeus = subcommands({
        name: 'zeus',
        description: `
        ZEUS_HOST: ${zeusHost ? chalk.green(zeusHost) : chalk.red('<unset>')}
        ${!!isLoggedIn.github ? chalk.green('logged in') : chalk.red('logged out')}
        `,
        cmds: { deploy, env, upgrade, login, run: runCmd, test: testCmd, init: initCmd},
    });
    run(zeus, process.argv.slice(2));
}

main();