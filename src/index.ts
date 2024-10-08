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
    const isLoggedIn = await load()

    const hasZeusHost = !!isLoggedIn?.zeusHostOwner;
    const zeusHost = isLoggedIn?.zeusHostOwner ? `${isLoggedIn?.zeusHostOwner}/${isLoggedIn?.zeusHostRepo}` : '<repo uninitialized>';
    
    const zeus = subcommands({
        name: 'zeus',
        description: `
        metadata: ${hasZeusHost ? chalk.green(zeusHost) : chalk.red(zeusHost)}
        ${!!isLoggedIn.github ? chalk.green('logged in!') : chalk.red('logged out')}
        `,
        cmds: { deploy, env, upgrade, login, run: runCmd, test: testCmd, init: initCmd},
    });
    run(zeus, process.argv.slice(2));
}

main();