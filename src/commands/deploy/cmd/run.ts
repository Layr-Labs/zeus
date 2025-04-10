import { command } from "cmd-ts";
import * as allArgs from '../../args';
import { TState, requires, isLoggedIn, inRepo, TInRepoState, isInRepo } from "../../inject";
import { configs, getRepoRoot } from '../../configs';
import { getActiveDeploy, phaseType, formatNow, blankDeploy } from "./utils";
import { join, normalize } from 'path';
import { existsSync, lstatSync } from "fs";
import { HaltDeployError, PauseDeployError, TStrategyOptions } from "../../../signing/strategy";
import chalk from "chalk";
import { canonicalPaths } from "../../../metadata/paths";
import { createTestClient, http, parseEther, toHex } from "viem";
import * as AllChains from "viem/chains";
import * as allChains from 'viem/chains';
import semver from 'semver';
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";
import { chainIdName } from "../../prompts";
import { AnvilOptions, AnvilService } from '@foundry-rs/hardhat-anvil/dist/src/anvil-service';
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { TenderlyVirtualTestnetClient, VirtualTestNetResponse } from "./utils-tenderly";
import { AnvilTestClient, TenderlyTestClient, TestClient } from "./utils-testnets";
import { TDeploy, TEnvironmentManifest, TUpgrade } from "../../../metadata/schema";
import { acquireDeployLock, releaseDeployLock } from "./utils-locks";
import { executeSystemPhase } from "../../../deploy/handlers/system";
import { executeMultisigPhase } from "../../../deploy/handlers/gnosis";
import { executeEOAPhase } from "../../../deploy/handlers/eoa";
import { executeScriptPhase } from "../../../deploy/handlers/script";

process.on("unhandledRejection", (error) => {
    console.error(error); // This prints error with stack included (as for normal errors)
    throw error; // Following best practices re-throw error and let the process exit with error code
});

const ANVIL_MNENOMIC = 'test test test test test test test test test test test junk';
const DEFAULT_ANVIL_PATH = "m/44'/60'/0'/0/";
const DEFAULT_ANVIL_PORT = 8546;
const DEFAULT_ANVIL_URI = `http://127.0.0.1:8546/`;

const isValidFork = (fork: string | undefined) => {
    return [undefined, `anvil`, `tenderly`].includes(fork);
} 


const throwIfUnset = (envVar: string | undefined, msg: string) => {
    if (!envVar) {
        throw new Error(msg);
    }
    return envVar;
}

const cleanUpgrade = (slug: string) => {
    return slug
            .replaceAll(`.`, ``)
            .replaceAll(`-`, ``)
}

export async function handler(_user: TState, args: {env: string, resume: boolean, rpcUrl: string | undefined, json: boolean, upgrade: string | undefined, nonInteractive: boolean | undefined, fork: string | undefined}) {
    if (!isValidFork(args.fork)) {
        throw new Error(`Invalid value for 'fork' - expected one of (tenderly, anvil)`);
    }

    if (!args.fork && !isLoggedIn(_user)) {
        throw new Error(`To deploy to an environment, you must run from within the contracts repo while logged in.`);
    } else if (!isInRepo(_user)) {
        throw new Error(`Must be run from within the contracts repo.`);
    }
    const user = _user;

    const repoConfig = await configs.zeus.load();
    if (!repoConfig) {
        console.error("This repo is not setup. Try `zeus init` first.");
        return;
    }

    let anvil: AnvilService | undefined;
    let tenderly: TenderlyVirtualTestnetClient | undefined;
    let tenderlyTestnet: VirtualTestNetResponse | undefined;
    let overrideEoaPk: `0x${string}` | undefined;
    let overrideRpcUrl: string | undefined;
    let testClient: TestClient | undefined;
    
    if (args.fork) {
        user.metadataStore = user.loggedOutMetadataStore; // force log out.
    }
    const metaTxn = await user.metadataStore.begin();
    const envManifest = await metaTxn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));

    const chain = Object.values((allChains as unknown as AllChains.Chain<undefined>[])).find(chain => chain.id === envManifest._.chainId)
    const forkUrl = chain?.rpcUrls ? Object.values(chain.rpcUrls)[0].http[0] : undefined;
            
    switch (args.fork) {
        case `tenderly`: {
            tenderly = new TenderlyVirtualTestnetClient(
                throwIfUnset(process.env.TENDERLY_API_KEY, "Expected TENDERLY_API_KEY to be set."),
                throwIfUnset(process.env.TENDERLY_ACCOUNT_SLUG, "Expected TENDERLY_ACCOUNT_SLUG to be set."),
                throwIfUnset(process.env.TENDERLY_PROJECT_SLUG, "Expected TENDERLY_PROJECT_SLUG to be set."),
            );

            const vnetSlug = `${args.env}-${args.upgrade}-${formatNow()}`
            tenderlyTestnet = await tenderly.createVirtualNetwork({
                slug: cleanUpgrade(vnetSlug),
                display_name: `${args.env} - ${args.upgrade}`,
                description: `automatically deployed via Zeus`,
                fork_config: {
                    network_id: Number(envManifest._.chainId),
                },
                virtual_network_config: {
                    chain_config: {
                        chain_id: Number(envManifest._.chainId)
                    },
                    sync_state_config: {
                        enabled: false
                    },
                    explorer_page_config: {
                        enabled: false
                    },
                }
            })
            const tenderlyRpcUrl = tenderlyTestnet.rpcs ? tenderlyTestnet.rpcs[0].url : undefined;
            if (!tenderlyRpcUrl) {
                throw new Error(`Failed to load tenderly RPC URL.`);
            }

            console.log(chalk.green(`+ created tenderly devnet: https://dashboard.tenderly.co/${process.env.TENDERLY_ACCOUNT_SLUG}/${process.env.TENDERLY_PROJECT_SLUG}/testnet/${tenderlyTestnet.id}\n`));

            testClient = new TenderlyTestClient(tenderlyRpcUrl);

            const specialAccountPk = generatePrivateKey();
            const specialAccountAddress = privateKeyToAccount(specialAccountPk).address;

            overrideRpcUrl = tenderlyRpcUrl;
            overrideEoaPk = specialAccountPk;

            // fund the special account.
            console.log(chalk.gray(`+ using deployer address ${specialAccountAddress}`));

            await testClient.setBalance(specialAccountAddress as `0x${string}`, parseEther('420'));
            
            break;
        }
        case `anvil`: {
            const opts: AnvilOptions = {
                hdPath: DEFAULT_ANVIL_PATH,
                mnemonic: ANVIL_MNENOMIC,
                url: DEFAULT_ANVIL_URI,
                port: DEFAULT_ANVIL_PORT,
                hostname: DEFAULT_ANVIL_URI,
                forkUrl: forkUrl?.trim(),
                launch: true,
                accounts: {
                    mnemonic: ANVIL_MNENOMIC,
                    path: DEFAULT_ANVIL_PATH
                }
            };
            anvil = await AnvilService.create(opts, false);
            const viemClient = createTestClient({
                mode: 'anvil',
                transport: http(DEFAULT_ANVIL_URI)
            });
            testClient = new AnvilTestClient(viemClient);
            const pkRaw = mnemonicToAccount(ANVIL_MNENOMIC, {accountIndex: 0}).getHdKey().privateKey;
            if (!pkRaw) {
                throw new Error(`Invalid private key for anvil test account.`);
            }
            overrideEoaPk = toHex(pkRaw);
            overrideRpcUrl = DEFAULT_ANVIL_URI;
            break;
        }
        case undefined:
            break;
        default:
            throw new Error(`Unsupported fork type: ${args.fork}`);
    }
    try {
        const deploy = await getActiveDeploy(metaTxn, args.env);
        if (deploy) {
            if (args.upgrade || !args.resume) {
                console.error(`Existing deploy in progress. Please rerun with --resume (and not --upgrade, as the current upgrade is ${deploy._.upgrade}).`)
                console.error(chalk.bold(`\n\t\tzeus deploy run --resume --env ${deploy._.env}`))
                return;
            }

            console.log(`[${chainIdName(deploy._.chainId)}] Resuming existing deploy... (began at ${deploy._.startTime})`);
            return await executeOrContinueDeployWithLock(deploy._.name, deploy._.env, user, {
                defaultArgs: {
                    rpcUrl: overrideRpcUrl, 
                    nonInteractive: !!args.nonInteractive,
                    fork: args.fork,
                    anvil,
                    testClient,
                    overrideEoaPk,
                    etherscanApiKey: args.fork ? false : undefined,
                },
                nonInteractive: !!args.fork
            });
        } else if (args.resume) {
            console.error(`Nothing to resume.`);
            return;
        }

        if (!args.upgrade) {
            console.error(`Must specify --upgrade <upgradeName>`);
            return;
        }

        const upgradePath = normalize(join(repoConfig.migrationDirectory, args.upgrade));
        const absoluteUpgradePath = normalize(join(getRepoRoot(), upgradePath))

        if (!existsSync(absoluteUpgradePath) || !lstatSync(absoluteUpgradePath).isDirectory() ) {
            console.error(`Upgrade ${args.upgrade} doesn't exist, or isn't a directory. (searching '${absoluteUpgradePath}')`)
            return;
        }
        const blankDeployName = `${formatNow()}-${args.upgrade}`;
        const envManifest = await metaTxn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(args.env));
        const deployJsonPath = canonicalPaths.deployStatus({env: args.env, name: blankDeployName});
        const deployJson = await metaTxn.getJSONFile<TDeploy>(deployJsonPath);

        const upgradeManifest = await metaTxn.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(args.upgrade));
        if (!semver.satisfies(envManifest._.deployedVersion ?? '0.0.0', upgradeManifest._.from)) {
            console.error(`Unsupported upgrade. ${upgradeManifest._.name} requires an environment meet the following version criteria: (${upgradeManifest._.from})`);
            console.error(`Environment ${envManifest._.id} is currently deployed at '${envManifest._.deployedVersion}'`);
            return;
        }

        deployJson._ = blankDeploy({name: blankDeployName, chainId: envManifest._.chainId, env: args.env, upgrade: args.upgrade, upgradePath, segments: upgradeManifest._.phases.map((phase, idx) => {
            return {...phase, id: idx};
        })});;
        await deployJson.save();

        console.log(chalk.green(`+ creating deploy: ${deployJsonPath}`));
        console.log(chalk.green(`+ started deploy (${envManifest?._.deployedVersion ?? '0.0.0'}) => (${upgradeManifest._.to}) (requires: ${upgradeManifest._.from})`));
        await metaTxn.commit(`started deploy: ${deployJson._.env}/${deployJson._.name}`);
        await executeOrContinueDeployWithLock(deployJson._.name, deployJson._.env, user, {
            defaultArgs: {
                rpcUrl: overrideRpcUrl ?? args.rpcUrl, 
                nonInteractive: !!args.nonInteractive,
                fork: args.fork,
                anvil,
                testClient,
                overrideEoaPk,
                etherscanApiKey: args.fork ? false : undefined,
            },
            nonInteractive: !!args.fork
        });
    } finally {
        // shut down anvil after running
        anvil?.stopServer();
        await anvil?.waitUntilClosed();
    }
}

const executeOrContinueDeployWithLock = async (name: string, env: string, user: TInRepoState, options: TStrategyOptions) => {
    const shouldUseLock = !options.defaultArgs.fork;
    if (options.defaultArgs.fork) {
        // explicitly choose the logged out metadata store, to avoid writing anything.
        chalk.bold(`Deploying to fork: ${options.defaultArgs.fork}`);
        user.metadataStore = user.loggedOutMetadataStore;
        options.nonInteractive = true;
        options.defaultArgs.nonInteractive = true;
        options.defaultArgs.etherscanApiKey = false;
    }

    const txn = await user.metadataStore.begin();
    const deploy = await txn.getJSONFile<TDeploy>(canonicalPaths.deployStatus({name, env}))

    if (shouldUseLock) {
        const isLocked = await acquireDeployLock(deploy._, txn)
        if (!isLocked) {
            console.error(`Fatal: failed to acquire deploy lock.`);
            return;
        } else {
            if (txn.hasChanges()) {
                await txn.commit(`acquired deploy lock`);
            }
        }
    }

    try {
        const txn = await user.metadataStore.begin();
        const deploy = await txn.getJSONFile<TDeploy>(canonicalPaths.deployStatus({name, env}))
        await executeOrContinueDeploy(deploy, user, txn, options);
        if (txn.hasChanges()) {
            console.warn(`Deploy failed to save all changes. If you didn't manually exit, this could be a bug.`)
        }
    } finally {
        if (shouldUseLock) {
            const tx = await user.metadataStore.begin();
            await releaseDeployLock(deploy._, tx);
            await tx.commit('releasing deploy lock');
        }
    }
}

const executeOrContinueDeploy = async (deploy: SavebleDocument<TDeploy>, _user: TState, metatxn: Transaction, options: TStrategyOptions) => {
    try {
        while (true) {
            console.log(chalk.green(`[${deploy._.segments[deploy._.segmentId]?.filename ?? '<none>'}] ${deploy._.phase}`))
            const curPhaseType = phaseType(deploy._.phase);
            switch (curPhaseType) {
                case 'system': {
                    await executeSystemPhase(deploy, metatxn, options)
                    break;
                }
                case 'multisig': {
                    await executeMultisigPhase(deploy, metatxn, options)
                    break;
                }
                case 'eoa': {
                    await executeEOAPhase(deploy, metatxn, options)
                    break;
                } 
                case 'script': {
                    await executeScriptPhase(deploy, metatxn, options);
                    break;
                }
            }
        } 
    } catch (e) {
        if (e instanceof PauseDeployError) {
            chalk.gray(`The deploy stopped: ${e.message}`);
            return;
        }
        if (e instanceof HaltDeployError) {
            if (e.complete) {
                chalk.gray(`The deploy completed: ${e.message}`);
                return;
            }

            console.warn(`The deploy halted. See log output for more information.`);
            console.warn(e);
        } else {
            console.error(`An unknown error occurred while performing the deploy.`)
            console.error(`<see log output for more information on how to continue>`)
            console.error(`Full error:`)
            console.error(e);
        }

        if (metatxn.hasChanges()) {
            console.warn(`\tYour copy had outstanding changes that weren't committed.`)
            console.warn(`Modified files: `)
            console.warn(metatxn.toString());
        } else {
            console.log(chalk.italic(`Your copy had no outstanding changes to commit.`));
        }
    }
}


export default command({
    name: 'run',
    description: 'Deploy an upgrade onto an environment. `zeus deploy <environment> <upgrade>`',
    version: '1.0.0',
    args: {
        env: allArgs.env,
        upgrade: allArgs.upgrade,
        resume: allArgs.resume,
        json: allArgs.json,
        rpcUrl: allArgs.rpcUrl,
        nonInteractive: allArgs.nonInteractive,
        fork: allArgs.fork
    },
    handler: requires(handler, inRepo),
})
