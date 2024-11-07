import {appendFileSync, chmodSync, existsSync, mkdirSync, rmSync, writeFileSync} from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import pkg from "../package.json";
import util from 'util';
import { exec as _exec } from 'child_process';
const exec = util.promisify(_exec);

const ZEUS_VERSION = pkg.version;

function bytesToMegabytes(bytes: number) {
    const megabytes = bytes / (1024 * 1024);
    return megabytes.toFixed(2);
}

export const install = async() => {
    const targetDir = join(homedir(), '.zeusBin')
    if (!existsSync(targetDir)) {
        console.log(chalk.italic(`+ creating ~/.zeusBin`))
        mkdirSync(targetDir);
    }

    let spinner = ora('installing dependencies').start();
    try {
        await exec("npm i -g --no-deprecation usb node-hid @ledgerhq/hw-transport-node-hid")
        spinner.stopAndPersist({prefixText: '✅'});
    } catch (e) {
        spinner.stopAndPersist({prefixText: '❌'});
        console.warn(`failed to setup dependencies.`);
        console.error(e);
    }

    spinner = ora('downloading zeus').start();
    try {    
        const zeusBinaryPath = join(targetDir, 'zeus')
        const zeusBinaryContents = await (await fetch(`https://d2mlo472ao01at.cloudfront.net/zeus-${ZEUS_VERSION}`)).text();
        if (zeusBinaryContents === 'Not Found') {
            spinner.stopAndPersist({prefixText: '❌'});
            console.error(`fatal: zeus v${ZEUS_VERSION} not found.`);
            return;
        }
        if (existsSync(zeusBinaryPath)) {
            rmSync(zeusBinaryPath);
        }
        writeFileSync(zeusBinaryPath, zeusBinaryContents);
        chmodSync(zeusBinaryPath, 0o500);
        console.log(`+ saved zeus v${ZEUS_VERSION} to ${zeusBinaryPath} (${bytesToMegabytes(Buffer.byteLength(zeusBinaryContents, 'utf8'))}mb)`);
        spinner.stopAndPersist({prefixText: '✅'});
    } catch (e) {
        spinner.stopAndPersist({prefixText: '❌'});
        console.error(e);
        return;
    } 

    let configPath = undefined;
    if (!process.env.PATH?.split(':')?.includes(targetDir)) {
        console.log(chalk.italic(`+ adding ~/.zeusBin to $PATH.`))

        const zshPath = join(homedir(), '.zshrc');
        const bashPath = join(homedir(), '.bashrc');
        if (existsSync(zshPath)) {
            configPath = zshPath;
            appendFileSync(zshPath, `export PATH=$PATH:"${targetDir}"`);
        } else if (existsSync(bashPath)) {
            configPath = bashPath;
            appendFileSync(bashPath, `export PATH=$PATH:"${targetDir}"`);
        } else {
            console.warn(`No .zshrc or .bashrc found. 'zeus' will not be added to path.`);
        }
    }

    console.log(chalk.green(`zeus ${ZEUS_VERSION} installed.`));
    if (configPath) {
        console.warn(`To make sure 'zeus' is in your path, run:`);
        console.warn(`\tsource ${configPath}`);
    }
}


