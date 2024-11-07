#!/usr/bin/env node

import 'source-map-support/register';
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
import {zeus as zeusInfo} from './metadata/meta';
import { install } from './install';

const isRunningAsInstallScript = () => {
    return process.argv[1] === '-';
}

const main = async () => {
    // check whether we are running on a host with zeus installed.
    if (isRunningAsInstallScript()) {
        install();
        return;
    }

    const state = await load()
    const isLoggedIn = await state.metadataStore?.isLoggedIn() ?? false;
    const hasZeusHost = !!state?.zeusHostOwner;
    const zeusHost = state?.zeusHostOwner ? `${state?.zeusHostOwner}/${state?.zeusHostRepo}` : '<repo uninitialized>';
    
    const zeus = subcommands({
        name: 'zeus',
        description: `
        metadata: ${hasZeusHost ? chalk.green(zeusHost) : chalk.red(zeusHost)}
        ${isLoggedIn ? chalk.green('logged in!') : chalk.red('logged out')}

        ${chalk.italic(`(zeus v${zeusInfo.Version}-${process.env.ZEUS_BUILD})`)}
        `,
        cmds: { deploy, env, upgrade, login, run: runCmd, test: testCmd, init: initCmd, which },
    });
    run(zeus, process.argv.slice(2));
}

main();