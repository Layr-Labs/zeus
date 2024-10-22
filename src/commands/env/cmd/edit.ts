import {command} from 'cmd-ts';
import {json} from '../../args';
import { loggedIn, requires, TState } from '../../inject';
import { Transaction } from '../../../metadata/metadataStore';
import { canonicalPaths } from '../../../metadata/paths';
import * as allArgs from '../../args';
import { editor } from '@inquirer/prompts';
import { wouldYouLikeToContinue } from '../../prompts';
import chalk from 'chalk';

export const loadExistingEnvs = async (txn: Transaction) => {
    const environments = await txn.getDirectory('environment');
    return environments.filter(e => e.type === 'dir');
};

async function handler(user: TState, args: {json: boolean |undefined, env: string}): Promise<void> {
    const txn = await user.metadataStore!.begin();
    const envs = await loadExistingEnvs(txn);

    const targetEnv = envs.find(e => e.name === args.env);
    if (!targetEnv) {
        console.error(`No such environment '${args.env}`);
        return;
    }

    const deployParams = await txn.getJSONFile<Record<string, unknown>>(canonicalPaths.deployParameters('', args.env));
    const updatedParamsText = await editor({
        message: `Update '${args.env}' parameters`,
        default: JSON.stringify(deployParams._ ?? {}, null, 2)
    });
    const updatedParams = JSON.parse(updatedParamsText);
    // TODO: we should validate deploy params...
    // TODO: we should show what the update diff is...
    if (!await wouldYouLikeToContinue()) {
        console.error(`Abort.`);
        return;
    }

    deployParams._ = updatedParams;
    if (deployParams.dirty) {
        await deployParams.save();
        await txn.commit(`Updated environment`);
        console.log(chalk.green(`+ updated environment '${args.env}'`))
    } else {
        console.warn(`No changes were made to ${args.env}.deployParameters.`);
    }
}

const cmd = command({
    name: 'edit',
    description: 'Edit the parameters for a particular environment.',
    version: '1.0.0',
    args: {
        env: allArgs.env,
        json,
    },
    handler: requires(handler, loggedIn),
})

export default cmd;