import {command } from 'cmd-ts';
import { loadExistingEnvs } from './list';
import { inRepo, loggedIn, requires, TState } from '../../inject';
import { question, select } from '../../utils';
import { TDeployManifest, TEnvironmentManifest } from '../../../metadata/schema'
import chalk from 'chalk';
import { canonicalPaths } from '../../../metadata/paths';

async function handler(user: TState): Promise<void> {
    const txn = await user.metadataStore!.begin();

    const existingEnvs = await loadExistingEnvs(txn);
    const envName = await question({
        text: "Environment name?",
        isValid: (text: string) => {
            const isValidRegex = /^[a-zA-Z0-9-]+$/.test(text);
            const isNotTaken = existingEnvs.filter(e => e.name === text).length == 0;
            return isValidRegex && isNotTaken;
        }
    });

    const chainId = await select({
        prompt: "Chain?",
        choices: [
            {name: 'Sepolia', value: 0xaa36a7, description: "ETH Sepolia Testnet"},
            {name: 'Holesky', value: 0x4268, description: "ETH Holesky Testnet"},
            {name: 'Mainnet', value: 0x1,  description: "ETH Mainnet"},
        ]
    });

    // Step 2: Create a new folder in the default branch
    const envManifestContent: TEnvironmentManifest = {
        id: `${envName}`,
        deployedVersion: '0.0.0',
        contractAddresses: {},
        latestDeployedCommit: '',
        chainId
    };

    const deployManifestContent: TDeployManifest = {
        inProgressDeploy: '',
    };

    const envManifest = await txn.getJSONFile(canonicalPaths.environmentManifest(envName));
    const deployManifest = await txn.getJSONFile(canonicalPaths.deploysManifest(envName));

    envManifest._ = envManifestContent;
    deployManifest._ = deployManifestContent

    await envManifest.save();
    await deployManifest.save();

    // Create a new file in the repository (which effectively creates the folder)
    try {
        await txn.commit(`Created environment: ${envName}`);
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