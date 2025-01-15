#!/usr/bin/env node

import 'source-map-support/register';
import { subcommands, run } from "cmd-ts";
import deploy from './commands/deploy/deploy';
import env from './commands/env/env';
import upgrade from './commands/upgrade/upgrade';
import chalk from 'chalk';
import login from './commands/login/login';
import { load } from "./commands/inject";
import runCmd from './commands/run';
import testCmd from './commands/test';
import initCmd from './commands/init';
import which from './commands/which';
import {zeus as zeusInfo} from './metadata/meta';

export const getZeus = async () => {
    const state = await load()
    const isLoggedIn = await state.metadataStore?.isLoggedIn() ?? false;
    const hasZeusHost = !!state?.zeusHostOwner;
    const zeusHost = state?.zeusHostOwner ? `${state?.zeusHostOwner}/${state?.zeusHostRepo}` : '<repo uninitialized>';
    
    return subcommands({
        name: 'zeus',
        description: `
        metadata: ${hasZeusHost ? chalk.green(zeusHost) : chalk.red(zeusHost)}
        ${isLoggedIn ? chalk.green('logged in!') : chalk.red('<read only>')}

        ${chalk.italic(`(zeus v${zeusInfo.Version}-${process.env.ZEUS_BUILD})`)}
        `,
        cmds: { deploy, env, upgrade, login, run: runCmd, test: testCmd, init: initCmd, which },
    });
}

export const main = async () => {
   const zeus = await getZeus();
   run(zeus, process.argv.slice(2));
}

main();