import {command} from 'cmd-ts';
import {json} from '../../args';
import { assertInRepo, requires, TState, withHost } from '../../inject';
import { Transaction } from '../../../metadata/metadataStore';
import { TEnvironmentManifest } from '../../../metadata/schema';
import { canonicalPaths } from '../../../metadata/paths';
import { chainIdName } from '../../prompts';

export const loadExistingEnvs = async (txn: Transaction) => {
    const environments = await txn.getDirectory('environment');
    return environments.filter(e => e.type === 'dir');
};

export async function handler(_user: TState, args: {json: boolean |undefined}): Promise<void> {
    const user = assertInRepo(_user);
    const txn = await user.metadataStore.begin();
    const envs = await loadExistingEnvs(txn);

    if (args.json) {
        console.log(JSON.stringify(envs));
    } else {
        if (envs && envs.length > 0) {
            console.log(`Found ${envs.length} environment${envs.length > 1 ? 's' : ''}:`)
            const manifests = await Promise.all(envs.map(async e => await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(e.name))))
            const entries = envs.map((e, index) => {
                return {name: e.name, version: manifests[index]._.deployedVersion ?? '0.0.0', chain: chainIdName(manifests[index]._.chainId)}
            });
            console.table(entries);
        } else {
            console.log(`No environments yet. Create one with 'zeus env new'`);
        }
    }
}

const cmd = command({
    name: 'list',
    description: 'list available environments',
    version: '1.0.0',
    args: {
        json,
    },
    handler: requires(handler, withHost),
})

export default cmd;