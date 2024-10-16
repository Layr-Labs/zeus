import {command} from 'cmd-ts';
import {requires } from './inject';
import { configs, getRepoRoot } from './configs';
import { question } from './utils';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import chalk from 'chalk';

const handler = async function() {
    const repoConfig = await configs.zeus.load();

    if (repoConfig !== undefined) {
        console.error(`This repo already has a zeus config ("${await configs.zeus.path()}"). Please modify '.zeus' directly.`);
        process.exit(1);
    }

    const zeusHost = await question({
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

    const migrationDirectory = await question({
        text: 'Upgrade scripts directory',
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
    handler: requires(handler),
})
export default cmd;