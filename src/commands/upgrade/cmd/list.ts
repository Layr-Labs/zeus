import {command} from 'cmd-ts';
import {json} from '../../args';
import { loggedIn, requires, TState } from '../../inject';
import { canonicalPaths } from '../../../metadata/paths';
import { TUpgrade } from '../../../metadata/schema';

const handler = async function(user: TState) {
    const txn = await user.metadataStore!.begin();
    const upgrades = await txn.getDirectory(canonicalPaths.allUpgrades());
    if (!upgrades) {
        console.error(`No upgrades have been registered. Register one with 'zeus upgrade new'`);
        return;
    }
    const upgradesAndManifests = await Promise.all(upgrades.filter(entry => entry.type === 'dir').map(async upgradeDir => {
        return {
            name: upgradeDir,
            manifest: await txn.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(upgradeDir.name))
        }
    }));
    upgradesAndManifests.forEach(data => {
        if (!data.manifest) {
            console.log(`\t - ${data.name.name} (couldnt load manifest)`);
        } else {
            console.log(`\t - ${data.name.name} ('${data.manifest!._.name}') - (${data.manifest?._.from}) => ${data.manifest?._.to}`)
        }
    })
};

const cmd = command({
    name: 'list',
    description: 'list all upgrades available',
    version: '1.0.0',
    args: {
        json,
    },
    handler: requires(handler, loggedIn),
})
export default cmd;