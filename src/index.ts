#!/usr/bin/env node

import { run } from "cmd-ts";
import chalk from 'chalk';
import {zeus as zeusInfo} from './metadata/meta';

// Minimal startup - only load what's needed
const main = async () => {
    const args = process.argv.slice(2);
    const subcommand = args[0];
    
    // Fast path for --version
    if (args.includes('--version') || args.includes('-v')) {
        console.log(`zeus v${zeusInfo.Version}-${process.env.ZEUS_BUILD}`);
        return;
    }

    // Fast path for --help with no subcommand
    if (!subcommand || (args.length === 1 && (args[0] === '--help' || args[0] === '-h'))) {
        console.log(`zeus <subcommand>
> ${chalk.italic(`(zeus v${zeusInfo.Version}-${process.env.ZEUS_BUILD})`)}

where <subcommand> can be one of:

- deploy - promotes an environment by replaying its upgrade script and triggering a sign of the transaction.
- env - list important information about an environment
- upgrade - Manage and create different protocol upgrades
- login - login to zeus
- run - run a command with all latest deployed contract addresses for a particular environment injected. Follows the format \`export DEPLOYED_CONTRACTNAME="0x..."\`
- test - Runs the test function of a ZeusScript, injecting the required parameters and deployed contract addresses.\`
- init - initializes a new project with zeus
- which - Search for a contract address or contract name in an environment.\`
- shell - Enters a new shell, setting all relevant zeus env variables. Convenient for local testing.
- script - Run a forge script that extends \`ZeusScript\`

For more help, try running \`zeus <subcommand> --help\``);
        return;
    }

    // Lazy load only the specific command needed
    let cmd;
    switch (subcommand) {
        case 'deploy':
            cmd = (await import('./commands/deploy/deploy')).default;
            break;
        case 'env':
            cmd = (await import('./commands/env/env')).default;
            break;
        case 'upgrade':
            cmd = (await import('./commands/upgrade/upgrade')).default;
            break;
        case 'login':
            cmd = (await import('./commands/login/login')).default;
            break;
        case 'run':
            cmd = (await import('./commands/run')).default;
            break;
        case 'test':
            cmd = (await import('./commands/test')).default;
            break;
        case 'init':
            cmd = (await import('./commands/init')).default;
            break;
        case 'which':
            cmd = (await import('./commands/which')).default;
            break;
        case 'shell':
            cmd = (await import('./commands/shell')).default;
            break;
        case 'script':
            cmd = (await import('./commands/script')).default;
            break;
        default:
            console.error(chalk.red(`Unknown command: ${subcommand}`));
            console.error(`Run 'zeus --help' for usage information`);
            process.exit(1);
    }

    // Now load the update checker in background (non-blocking)
    setImmediate(async () => {
        try {
            const { checkForUpdates } = await import('./commands/utils');
            await checkForUpdates();
        } catch {
            // Silently fail
        }
    });

    // Run the command
    run(cmd, args.slice(1));
}

main();