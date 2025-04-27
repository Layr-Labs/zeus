import {command} from 'cmd-ts';
import {assertLoggedIn, loggedIn, requires, TState } from './inject';
import { configs, getRepoRoot } from './configs';
import { question } from './utils';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { Octokit } from 'octokit';


const getZeusMetadataRepo = async (github: Octokit) => {
    while (true) {
        const host = await question({
            text: `Where is your zeus metadata repo located? ${chalk.italic('NOTE: You must have the zeus app installed on this repo.')} (e.g https://github.com/my-org/project.git)`,
            isValid: (t) => {
                try {
                    const url = new URL(t);
                    if (!(url.origin === 'https://github.com')) {
                        return false;
                    }
                    // TODO: check whether the user can access this repo...
                    return true;
                } catch {
                    return false;
                }
            },
        })

        const parts = host.toString().split('/');
        try {
            await github.rest.repos.get({
                repo: parts[parts.length - 1],
                owner: parts[parts.length - 2],
            })
            return host;
        } catch (e) {
            console.error(`Error: you can't access this repo. Make sure you've approved ZeusDeployer to access this repo on your behalf.`)
            console.error(e);
        }
    }
}

export const handler = async function(_user: TState) {
    const repoConfig = await configs.zeus.load();
    const user = assertLoggedIn(_user);

    if (repoConfig !== undefined) {
        console.error(`This repo already has a zeus config ("${await configs.zeus.path()}"). Please modify '.zeus' directly.`);
        process.exit(1);
    }

    const zeusHost = await getZeusMetadataRepo(user.github);
    const migrationDirectory = await question({
        text: 'Upgrade scripts directory',
        isValid: (t) => {
            const root = getRepoRoot();
            const dirPath = path.join(root, t)
            return path.normalize(dirPath).startsWith(root); // this should be a subdirectory of the repo.
        },
    })

    const migrationDirectoryNormalized = path.join(getRepoRoot(), migrationDirectory);
    if (!fs.existsSync(migrationDirectoryNormalized)) {
        fs.mkdirSync(migrationDirectoryNormalized, {recursive: true});
        console.log(chalk.green(`+ created directory '${migrationDirectoryNormalized}'`))
    }

    await configs.zeus.write({
        zeusHost,
        migrationDirectory
    })
};

const cmd = command({
    name: 'init',
    description: 'initializes a new project with zeus',
    version: '1.0.0',
    args: {},
    handler: requires(handler, loggedIn),
})
export default cmd;