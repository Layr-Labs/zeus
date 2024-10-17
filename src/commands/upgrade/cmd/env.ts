import {command, positional, string} from 'cmd-ts';
import {json} from '../../args';
import { loggedIn, requires, TState } from '../../inject';
import { canonicalPaths } from '../../../metadata/paths';
import { TEnvironmentManifest, TUpgrade } from '../../../metadata/schema';
import * as allArgs from '../../args';
import { findUpgradePath } from '../utils';

const handler = async function(user: TState, args: {version: string, env: string}) {
    const upgrades = await user.metadataStore!.getDirectory(canonicalPaths.allUpgrades());
    if (!upgrades) {
        console.error(`No upgrades have been registered. Register one with 'zeus upgrade new'`);
        return;
    }
    const upgradesAndManifests = await Promise.all(upgrades.filter(entry => entry.type === 'dir').map(async upgradeDir => {
        return {
            name: upgradeDir,
            manifest: await user.metadataStore!.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(upgradeDir.name))
        }
    }));
    const availableUpgrades = upgradesAndManifests.filter(up => up.manifest !== undefined).map(up => up.manifest) as TUpgrade[];
    
    const environment = await user.metadataStore!.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));
    const version = environment?.deployedVersion ?? '0.0.0';
    const upgradePath = findUpgradePath(version, args.version, availableUpgrades)
    console.log(upgradePath);
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