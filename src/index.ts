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
import shell from './commands/shell';
import {zeus as zeusInfo} from './metadata/meta';
import pkgInfo from '../package.json';
import { execSync } from 'child_process';
import { compare } from 'compare-versions';
import { configs } from './commands/configs';

const HOURS = (1000) * (60) * (60);

const main = async () => {
    const zeusProfile = await configs.zeusProfile.load();
    if (zeusProfile?.lastUpdateCheck === undefined || Date.now() - zeusProfile?.lastUpdateCheck > (3 * HOURS)) {
        const latestRemoteVersion = execSync(`npm view ${pkgInfo.name} version`).toString().trim();
        const currentVersion = pkgInfo.version;

        if (compare(latestRemoteVersion, currentVersion, '>')) {
            console.log(chalk.yellow(`==================================================`))
            console.log(chalk.yellow(`A new version (${latestRemoteVersion}) is available!\n`))
            console.log(chalk.bold.yellow(`\tnpm install -g @layr-labs/zeus`))
            console.log(chalk.yellow(`==================================================`))
        }   
        
        configs.zeusProfile.write({
            ...zeusProfile,
            lastUpdateCheck: Date.now()
        })
    }

    const state = await load()
    const isLoggedIn = await state.metadataStore?.isLoggedIn() ?? false;
    const hasZeusHost = !!state?.zeusHostOwner;
    const zeusHost = state?.zeusHostOwner ? `${state?.zeusHostOwner}/${state?.zeusHostRepo}` : '<repo uninitialized>';
    
    const zeus = subcommands({
        name: 'zeus',
        description: `
        metadata: ${hasZeusHost ? chalk.green(zeusHost) : chalk.red(zeusHost)}
        ${isLoggedIn ? chalk.green('logged in!') : chalk.red('<read only>')}

        ${chalk.italic(`(zeus v${zeusInfo.Version}-${process.env.ZEUS_BUILD})`)}
        `,
        cmds: { deploy, env, upgrade, login, run: runCmd, test: testCmd, init: initCmd, which, shell },
    });
    run(zeus, process.argv.slice(2));
}

main();