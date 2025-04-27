import {command} from 'cmd-ts';
import {json} from '../../args';
import { assertInRepo, withHost, requires, TState } from '../../inject';
import { canonicalPaths } from '../../../metadata/paths';
import { TEnvironmentManifest, TUpgrade } from '../../../metadata/schema';
import { envOptional } from '../../args';
import semver from 'semver';

export const handler = async function(_user: TState, args: {env: string | undefined}) {
    const user = assertInRepo(_user);
    const txn = await user.metadataStore.begin();
    const forRequiredVersion = await (async () => {
        if (!args.env) {
            return undefined;
        }
        const env = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));
        if (env === undefined || Object.keys(env._).length === 0) {
            throw new Error(`No such environment: ${args.env}`);
        }

        return env._.deployedVersion;
    })();

    const upgrades = await txn.getDirectory(canonicalPaths.allUpgrades());
    if (!upgrades || upgrades.length === 0) {
        console.error(`No upgrades have been registered. Register one with 'zeus upgrade new'`);
        return;
    }

    let upgradesAndManifests = await Promise.all(upgrades.filter(entry => entry.type === 'dir').map(async upgradeDir => {
        return {
            name: upgradeDir,
            manifest: await txn.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(upgradeDir.name))
        }
    }));


    if (forRequiredVersion !== undefined) {
        upgradesAndManifests = upgradesAndManifests.filter(upMan => semver.satisfies(forRequiredVersion, upMan.manifest._.from));
    }

    upgradesAndManifests.forEach(data => {
        if (!data.manifest) {
            console.log(`\t - ${data.name.name} (couldnt load manifest)`);
        } else {
            console.log(`\t - ${data.name.name} ('${data.manifest._.name}') - (${data.manifest?._.from}) => ${data.manifest?._.to}`)
        }
    })
};

const cmd = command({
    name: 'list',
    description: 'list all upgrades available',
    version: '1.0.0',
    args: {
        json,
        env: envOptional
    },
    handler: requires(handler, withHost),
})
export default cmd;