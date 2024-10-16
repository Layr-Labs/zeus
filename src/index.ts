#!/usr/bin/env node

import { subcommands, run } from "cmd-ts";
import deploy from './commands/deploy/deploy';
import env from './commands/env/env';
import upgrade from './commands/upgrade/upgrade';
import chalk from 'chalk';
import login from './commands/login/login';
import { load } from "./commands/inject.js";
import runCmd from './commands/run';
import testCmd from './commands/test';
import initCmd from './commands/init';
import which from './commands/which';

const main = async () => {
    const state = await load()

    const isLoggedIn = await state.metadataStore?.isLoggedIn() ?? false;

    const hasZeusHost = !!state?.zeusHostOwner;
    const zeusHost = state?.zeusHostOwner ? `${state?.zeusHostOwner}/${state?.zeusHostRepo}` : '<repo uninitialized>';
    
    const zeus = subcommands({
        name: 'zeus',
        description: `
        metadata: ${hasZeusHost ? chalk.green(zeusHost) : chalk.red(zeusHost)}
        ${isLoggedIn ? chalk.green('logged in!') : chalk.red('logged out')}
        `,
        cmds: { deploy, env, upgrade, login, run: runCmd, test: testCmd, init: initCmd, which },
    });
    run(zeus, process.argv.slice(2));
}

main();