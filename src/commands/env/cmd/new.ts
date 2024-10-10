import {command } from 'cmd-ts';
import { loadExistingEnvs } from './list.js';
import { inRepo, loggedIn, requires, TState } from '../../inject.js';
import { question } from '../../utils.js';
import { Environment } from '../../../metadata/environment.js';
import chalk from 'chalk';

async function handler(user: TState, args: {}): Promise<void> {
    const gh = user.github!;
    const existingEnvs = await loadExistingEnvs(user);
    const zeusRepo = {
        owner: user.zeusHostOwner!,
        repo: user.zeusHostRepo!,
    }
    const { data: repoData } = await gh.rest.repos.get(zeusRepo);
    const defaultBranch = repoData.default_branch;

    const envName = await question({
        text: "Environment name?",
        isValid: (text: string) => {
            const isValidRegex = /^[a-zA-Z0-9-]+$/.test(text);
            const isNotTaken = existingEnvs.filter(e => e === text).length == 0;
            return isValidRegex && isNotTaken;
        },
        maxAttempts: 5,
        errorMessage: "failed to create environment"
    });

    var latestCommitSha: string;
    try {
        const { data: baseBranchData } = await gh!.rest.repos.getBranch({
            ...zeusRepo,
            branch: defaultBranch, // default branch
        });

        latestCommitSha = baseBranchData.commit.sha;
    } catch (e) {
        if (`${e}`.includes('Branch not found')) {
            throw new Error(`ZEUS_HOST is uninitialized. Please push a blank commit to it. Thanks!`);
        } else {
            throw e;
        }
    }

    // Step 2: Create a new folder in the default branch
    const newFolderPath = `environment/${envName}/manifest.json`;
    const deploysFolder = `environment/${envName}/deploys/deploys.json`;
    const ugradesFolder = `environment/${envName}/upgrades/upgrades.json`;

    const content = JSON.stringify({
        id: `${envName}`,
        precedes: '',
        contractAddresses: {},     
        signingStrategy: '',       
        latestDeployedCommit: '',
    } as Environment, null, ' ');

    // Create a new file in the repository (which effectively creates the folder)
    try {
        await gh.rest.repos.createOrUpdateFileContents({
            ...zeusRepo,
            path: newFolderPath,
            message: `Create environment: ${envName}`,
            content: Buffer.from(content).toString('base64'),
            branch: defaultBranch,
            sha: latestCommitSha,
        });

        await gh.rest.repos.createOrUpdateFileContents({
            ...zeusRepo,
            path: deploysFolder,
            message: `Initialized environment: ${envName} [1/2]`,
            content: Buffer.from(content).toString('base64'),
            branch: defaultBranch,
            sha: latestCommitSha,
        });

        await gh.rest.repos.createOrUpdateFileContents({
            ...zeusRepo,
            path: ugradesFolder,
            message: `Initialized environment: ${envName} [2/2]`,
            content: Buffer.from(content).toString('base64'),
            branch: defaultBranch,
            sha: latestCommitSha,
        });

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