import {command } from 'cmd-ts';
import { loadExistingEnvs } from './list';
import { inRepo, loggedIn, requires, TState } from '../../inject';
import { question } from '../../utils';
import { TDeployManifest, TEnvironmentManifest, TUpgradeManifest } from '../../../metadata/schema'
import chalk from 'chalk';
import { canonicalPaths } from '../../../metadata/paths';

async function handler(user: TState): Promise<void> {
    const existingEnvs = await loadExistingEnvs(user);
    const envName = await question({
        text: "Environment name?",
        isValid: (text: string) => {
            const isValidRegex = /^[a-zA-Z0-9-]+$/.test(text);
            const isNotTaken = existingEnvs.filter(e => e === text).length == 0;
            return isValidRegex && isNotTaken;
        }
    });

    // Step 2: Create a new folder in the default branch
    const envManifestContent = {
        id: `${envName}`,
        precedes: '',
        contractAddresses: {},     
        signingStrategy: '',       
        latestDeployedCommit: '',
    } as TEnvironmentManifest;

    const deployManifestContent = {
        inProgressDeploy: '',
    } as TDeployManifest;

    const upgradesManifestContent = {
        upgrades: [],
    } as TUpgradeManifest; 

    // Create a new file in the repository (which effectively creates the folder)
    try {
        await user.metadataStore?.updateJSON(
            canonicalPaths.environmentManifest(envName),
            envManifestContent,
        );
        await user.metadataStore?.updateJSON(
            canonicalPaths.deploysManifest(envName),
            deployManifestContent,
        );
        await user.metadataStore?.updateJSON(
            canonicalPaths.ugradesManifest(envName),
            upgradesManifestContent
        );
        console.log(`${chalk.green('+')} created environment`);
    } catch (e) {
        throw new Error(`Failed to create environment folder: ${e}`);
    }
}

const cmd = command({
    name: 'new',
    description: 'create a new environment',
    version: '1.0.0',
    args: {},
    handler: requires(handler, loggedIn, inRepo),
})

export default cmd;