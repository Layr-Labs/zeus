import {command} from 'cmd-ts';
import { getRepoRoot, requiresLogin, TState } from './inject.js';
import { configs } from './inject.js';
import { question } from './utils.js';
import path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import chalk from 'chalk';

const handler = async function(user: TState, args: {}) {
    const repoConfig = await configs.zeus.load();

    if (repoConfig !== undefined) {
        console.error(`This repo already has a zeus config ("${await configs.zeus.path()}"). Please modify '.zeus' directly.`);
        process.exit(1);
    }

    const zeusHost = await question({
        text: `Where is your zeus metadata repo located? ${chalk.italic('NOTE: You must have the zeus app installed on this repo.')} (e.g https://github.com/my-org/project.git)`,
        maxAttempts: 5,
        errorMessage: "invalid metadata repo path",
        isValid: (t) => {
            try {
                new URL(t);
                // TODO: we could check whether this is a valid repo.
                return true;
            } catch {
                return false;
            }
        },
    })

    const migrationDirectory = await question({
        text: 'Upgrade scripts directory',
        maxAttempts: 5,
        errorMessage: "invalid upgrade scripts path.",
        isValid: (t) => {
            const root = getRepoRoot();
            const dirPath = path.join(root, t)
            return path.normalize(dirPath).startsWith(root); // this should be a subdirectory of the repo.
        },
    })

    const migrationDirectoryNormalized = path.join(getRepoRoot(), migrationDirectory);
    if (!existsSync(migrationDirectoryNormalized)) {
        mkdirSync(migrationDirectoryNormalized, {recursive: true});
        console.log(chalk.green(`+ created directory '${migrationDirectoryNormalized}'`))
    }

    await configs.zeus.write({
        zeusHost,
        migrationDirectory
    })
};

const cmd = command({
    name: 'init',
    description: 'initializes a contracts repo with zeus',
    version: '1.0.0',
    args: {},
    handler: requiresLogin(handler),
})
export default cmd;