import {command, positional, string} from 'cmd-ts';
import {json} from '../../args';
import { assertLoggedIn, loggedIn, requires, TState } from '../../inject';
import { canonicalPaths } from '../../../metadata/paths';
import { TEnvironmentManifest, TUpgrade } from '../../../metadata/schema';
import * as allArgs from '../../args';
import { findUpgradePaths } from '../utils';
import { wouldYouLikeToContinue } from '../../prompts';
import chalk from 'chalk';
import { SavebleDocument } from '../../../metadata/metadataStore';

const handler = async function(_user: TState, args: {version: string, env: string}) {
    const user = assertLoggedIn(_user);
    const metaTxn = await user.metadataStore.begin();

    const upgrades = await metaTxn.getDirectory(canonicalPaths.allUpgrades());
    if (!upgrades) {
        console.error(`No upgrades have been registered. Register one with 'zeus upgrade new'`);
        return;
    }
    const upgradesAndManifests = await Promise.all(upgrades.filter(entry => entry.type === 'dir').map(async upgradeDir => {
        return {
            name: upgradeDir,
            manifest: await metaTxn.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(upgradeDir.name))
        }
    }));
    const availableUpgrades = upgradesAndManifests.filter(up => up.manifest !== undefined).map(up => up.manifest) as SavebleDocument<TUpgrade>[];
    const environment = await metaTxn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));
    const version = environment?._?.deployedVersion ?? '0.0.0';
    const path = findUpgradePaths(version, args.version, availableUpgrades.map(e => e._));
    const upgradePath = path ? path[0] : undefined;
    
    if (!upgradePath) {
        console.error(`No suitable upgrade set found to bring ${args.env} up to ${version}`);
        return;
    }

    console.log(`Found upgrade plan: ${chalk.italic(`(from ${version} to ${args.version})`)}`);
    let prev = version;
    for (const plan of upgradePath) {
        const upgrade = availableUpgrades.find(up => up._.name === plan);
        if (!upgrade) {
            throw new Error(`Upgrade ${plan} doesn't exist.`);
        }
        console.log(`\t• ${upgrade?._.name}: ${prev} -> ${upgrade._.to}`);
        prev = upgrade._.to;
    }

    if (!await wouldYouLikeToContinue('This will start a series of deploys. Would you like to continue?')) {
        console.error(`Quitting.`);
        return;
    }

    console.error(`Abort: unimplemented.`);
};  

const cmd = command({
    name: 'env',
    description: 'Identify the upgrades to run to upgrade an environment to the target version',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.env,
        version: positional({type: string})
    },
    handler: requires(handler, loggedIn),
})
export default cmd;