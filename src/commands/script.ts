import {command, restPositionals, string, flag} from 'cmd-ts';
import {json} from './args';
import { withHost, requires, TState } from './inject';
import * as allArgs from './args';
import fs from 'fs';
import path from 'path';
import { loadExistingEnvs } from './env/cmd/list';
import { TDeploy, TDeployPhase, TEnvironmentManifest } from '../metadata/schema';
import { canonicalPaths } from '../metadata/paths';
import { SavebleDocument } from '../metadata/metadataStore';
import { stepDeploy } from './deploy/cmd/run';
import chalk from 'chalk';

const handler = async function(user: TState, args: {scripts: string[], multisig: boolean, eoa: boolean, json: boolean, env: string}) {
    if (!user.loggedOutMetadataStore) {
        throw new Error('uh oh.');
    }

    // Validate script path
    if (args.scripts.length !== 1) {
        console.error('Exactly one script must be specified');
        process.exit(1);
    }
    
    const scriptPath = args.scripts[0];
    if (!fs.existsSync(scriptPath)) {
        console.error(`Script not found: ${scriptPath}`);
        process.exit(1);
    }
    
    const txn = await user.loggedOutMetadataStore.begin();
    const envs = await loadExistingEnvs(txn);
    
    if (!envs.find(e => e.name === args.env)) {
        console.error(`No such environment: ${args.env}`);
        process.exit(1);
    }
    
    // Get current environment version
    const envManifest = await txn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));
    
    const strategyType = args.multisig ? 'multisig' : 'eoa';
    const startingPhase: TDeployPhase = args.multisig ? 'multisig_start' : 'eoa_validate';
    
    const dummyDeploy: TDeploy = {
        name: `script-${path.basename(scriptPath)}`,
        metadata: [],
        startTime: new Date().toString(),
        startTimestamp: Date.now(),
        upgrade: '',
        env: args.env,
        upgradePath: path.dirname(scriptPath),
        phase: startingPhase,
        segmentId: 0,
        segments: [
            {
                id: 0,
                type: strategyType,
                filename: path.basename(scriptPath)
            }
        ],
        chainId: envManifest._.chainId
    };
    console.log(`Running script: ${chalk.bold(path.basename(scriptPath))}`);
    
    const deployDoc = {
        _: dummyDeploy,
        save: async () => {
            //
        },
        path: ''
    } as SavebleDocument<TDeploy>;
    
    try {
        while (dummyDeploy.phase !== 'complete') {
            await stepDeploy(deployDoc, user, txn, {
                defaultArgs: {
                    nonInteractive: false,
                    rpcUrl: undefined,
                    fork: undefined
                },
                nonInteractive: false
            });
        }
        
        console.log(`Script execution completed successfully: ${scriptPath}`);
    } catch (error) {
        console.error(`Script execution failed (phase=${dummyDeploy.phase},segment=${dummyDeploy.segmentId+1}/${dummyDeploy.segments.length})`);
        console.error(error);
        process.exit(1);
    }
};

const cmd = command({
    name: 'script',
    description: 'Run a forge script that extends `ZeusScript`',
    version: '1.0.0',
    args: {
        json,
        env: allArgs.env,
        multisig: flag({
            long: 'multisig',
            description: 'Use multisig signing strategy',
        }),
        eoa: flag({
            long: 'eoa',
            description: 'Use EOA signing strategy',
        }),
        scripts: restPositionals({
            type: string,
            description: 'Path to script to execute'
        })
    },
    handler: requires(handler, withHost),
})

export default cmd;