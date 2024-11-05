import {command} from 'cmd-ts';
import {json} from '../../args';
import { assertLoggedIn, loggedIn, requires, TState } from '../../inject';
import { canonicalPaths } from '../../../metadata/paths';
import * as allArgs from '../../args';
import { editor } from '@inquirer/prompts';
import { wouldYouLikeToContinue } from '../../prompts';
import chalk from 'chalk';
import Ajv from "ajv"
import { loadExistingEnvs } from './list';

const ajv = new Ajv({allErrors: true});

async function handler(_user: TState, args: {json: boolean |undefined, env: string}): Promise<void> {
    const user = assertLoggedIn(_user);
    const txn = await user.metadataStore.begin();
    const envs = await loadExistingEnvs(txn);

    const deploySchemaPath = canonicalPaths.deployParametersSchema('');
    const deploySchema = await txn.getJSONFile(deploySchemaPath)

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
    
    // TODO: we should show what the update diff is...
    if (deploySchema && deploySchema._ && Object.keys(deploySchema._).length > 0) {
        try {
            const validate = ajv.compile(deploySchema._);
            if (!validate(updatedParams)) {
                console.error(`Failed to validate changes to ${args.env}.deployParameters:`);
                validate.errors?.forEach(e => {
                    console.error(`\t* ${e.message}`);
                });
                return;
            } else {
                console.log(chalk.green('✅ validated changes'))
            }
        } catch (e) {
            console.error(`An error occurred while validating your changes. They will not be saved.`);
            console.error(e);
            return;
        }
    } else {
        console.warn(`Warning: you have no deploy parameter schema set, so zeus cannot tell if this change will break deploys. Please update ZEUS_HOST://${deploySchemaPath}`);
    }

    if (!await wouldYouLikeToContinue()) {
        console.error(`Abort.`);
        return;
    }

    deployParams._ = updatedParams;
    await deployParams.save();
    if (deployParams.pendingSaveableContents()) {
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
        env: allArgs.envPositional,
        json,
    },
    handler: requires(handler, loggedIn),
})

export default cmd;