import {command} from 'cmd-ts';
import { loggedIn, requires, TState } from '../../inject';
import { Transaction } from '../../../metadata/metadataStore';
import { canonicalPaths } from '../../../metadata/paths';
import { editor } from '@inquirer/prompts';
import { wouldYouLikeToContinue } from '../../prompts';
import chalk from 'chalk';
import Ajv from "ajv"

const ajv = new Ajv({allErrors: true});


export const loadExistingEnvs = async (txn: Transaction) => {
    const environments = await txn.getDirectory('environment');
    return environments.filter(e => e.type === 'dir');
};

async function handler(user: TState): Promise<void> {
    const txn = await user.metadataStore!.begin();
    const envs = await loadExistingEnvs(txn);

    const deploySchemaPath = canonicalPaths.deployParametersSchema('');
    const deploySchema = await txn.getJSONFile(deploySchemaPath)

    const updatedSchemaText = await editor({
        message: `Update repo parameter schema`,
        default: JSON.stringify(deploySchema._ ?? {}, null, 2),
        validate: (value) => {
            try {
                return ajv.validateSchema(JSON.parse(value));
            } catch {
                return false;
            }
        }
    });
    const updatedSchema = JSON.parse(updatedSchemaText);
    const validate = ajv.compile(updatedSchema);
    
    // attempt to test it on all environments.
    const areValidEnvironments = await Promise.allSettled(envs.map(async (e) => {
        const file = await txn.getJSONFile(canonicalPaths.deployParameters('', e.name))
        return validate(file._) as boolean;
    }))

    areValidEnvironments.forEach((env, i) => {
        console.log(`* ${(env.status === 'rejected' || !env.value) ? '❌' : '✅'} ${envs[i].name}`)
    })

    const hasInvalidEnvironment = areValidEnvironments.filter(e => e.status === 'rejected' || !e.value);
    if (hasInvalidEnvironment.length > 0) {
        console.warn(`Warning: ${hasInvalidEnvironment.length} environments failed to validate after this change.`)
        console.warn(`Make sure you're ok with this before proceeding.`);
    }

    if (!await wouldYouLikeToContinue()) {
        console.error(`Abort.`);
        return;
    }

    deploySchema._ = updatedSchema;
    if (deploySchema.dirty) {
        await deploySchema.save();
        await txn.commit(`Updated schema`);
        console.log(chalk.green(`+ updated schema`))
    } else {
        console.warn(`No changes were made.`);
    }
}

const cmd = command({
    name: 'editSchema',
    description: 'Edit the parameter schema for the repo.',
    version: '1.0.0',
    args: {},
    handler: requires(handler, loggedIn),
})

export default cmd;