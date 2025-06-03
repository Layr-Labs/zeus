import { command } from "cmd-ts";
import {json} from '../../args';
import * as allArgs from '../../args';
import { assertInRepo, withHost, requires, TState } from "../../inject";
import { loadExistingEnvs } from "../../env/cmd/list";
import { execSync } from "child_process";
import ora from "ora";
import { rpcUrl } from "../../prompts";
import { getActiveDeploy } from "./utils";
import * as AllChains from "viem/chains";
import { canonicalPaths } from "../../../metadata/paths";
import { TForgeRequest, TGnosisRequest } from "../../../signing/strategy";
import { ForgeSolidityMetadata, TDeploy, TDeployedContractsManifest } from "../../../metadata/schema";
import { createPublicClient, hexToBytes, http, toHex } from "viem";
import { dirname, join } from "path";
import { computeFairHash } from "../utils";
import { getTrace } from "../../../signing/utils";
import chalk from "chalk";
import { readFileSync } from "fs";
import { configs } from "../../configs";
import EOASigningStrategy from "../../../signing/strategies/eoa/privateKey";
import { GnosisEOAApiStrategy } from "../../../signing/strategies/gnosis/api/gnosisEoa";

const currentUser = () => execSync('git config --global user.email').toString('utf-8').trim();

const getChain = (chainId: number) => {
    const chain = Object.values(AllChains).find(value => value.id === chainId);
    if (!chain) {
        throw new Error(`Unsupported chain ${chainId}`);
    }
    return chain;
}

const cleanContractName = (contract: string) => {   
    if (contract.endsWith('_Impl')) {
        return contract.substring(0, contract.length - `_Impl`.length);
    } else if (contract.endsWith('_Proxy')) {
        return contract.substring(0, contract.length - `_Proxy`.length);
    } else if (contract.endsWith('_Beacon')) {
        return contract.substring(0, contract.length - `_Beacon`.length);
    }
    return contract;
}

const shortenHex = (str: string) => {
    return str.substring(0, 5) + '...' + str.substring(str.length - 4);
}

async function handler(_user: TState, args: {env: string, deploy: string | undefined}) {
    try {
        const user = assertInRepo(_user);
        const metatxn = await user.loggedOutMetadataStore.begin();

        const envs = await loadExistingEnvs(metatxn);
        if (!envs.find(e => e.name === args.env)) {
            console.error(`No such environment: ${args.env}`);
            return;
        }

        const deploy = args.deploy === undefined ? await getActiveDeploy(metatxn, args.env) : await metatxn.getJSONFile<TDeploy>(
            canonicalPaths.deployStatus({env: args.env, name: args.deploy})
        );

        if (!deploy) {
            console.error(`No deploy to verify.`);
            return;
        }
        
        const customRpcUrl = await rpcUrl(deploy._.chainId);

        // TODO: verify that the current checkout is on the right commit to run the deploy.
        const prompt = ora(`Running 'forge build'...`);
        prompt.start();

        try {
            execSync('forge build', {encoding: 'utf-8'});
        } finally {
            prompt.stopAndPersist();
        }
        const deployedContracts = await metatxn.getJSONFile<TDeployedContractsManifest>(canonicalPaths.deployDeployedContracts(deploy._));
        if (!deployedContracts._?.contracts?.length || deployedContracts._?.contracts?.length === 0) {
            console.warn(`The remote claimed to produce no contracts as part of this upgrade so far. Re-run verify after some contracts are deployed.`);
            return;
        }
        
        for (let i = 0; i <= deploy._.segmentId; i++) {
            console.log(`Verifying deploy: step (${i+1}/${deploy._.segmentId+1})...`)
            const segment = deploy._.segments[i];
            const script = join(deploy._.upgradePath, deploy._.segments[i].filename);
                    
            switch (segment.type) {
                case 'eoa': {
                    // get all signers.
                    const signers = deployedContracts._.contracts.filter((contract) => contract.lastUpdatedIn.segment === i).map(contract => contract.lastUpdatedIn.signer);
                    if (!signers || signers.length == 0) {
                        console.log(`${i+1}: no contracts deployed.`);
                        continue;
                    }

                    const signer = signers[0];
                    const strategy = new EOASigningStrategy(deploy, metatxn, {nonInteractive: false, simulationAddress: signer, defaultArgs: {rpcUrl: customRpcUrl, etherscanApiKey: false}});
                    const prep = await strategy.prepare(script, deploy._) as TForgeRequest;
                    
                    if (!prep.deployedContracts || !prep.forge) {
                        if (deployedContracts._?.contracts?.length > 0) {
                            console.error(`The local copy didn't produce any contracts, but the remote claimed to produce the following contracts.`);
                            console.table(deployedContracts._.contracts)
                            console.error(`Make sure you're on the correct commit, and double check any deployed contracts before proceeding...`);
                            return;
                        }

                        console.log(`Both the local and remote copy didn't produce any contracts.`);
                        console.log(`This is not a bug -- the uprgade just didn't deploy anything.`);
                    }

                    if (deployedContracts._?.contracts?.length && deployedContracts._?.contracts?.length > 0) {
                        const chain = getChain(deploy._.chainId);
                        const publicClient = createPublicClient({chain, transport: http(customRpcUrl)})
                        const onchainBytecode: Record<string, `0x${string}`> = {};
            
                        const zeusConfigDirName = dirname(await configs.zeus.path());
                        const contractMetadata = Object.fromEntries(deployedContracts._.contracts.map(contract => {
                            const metadata = JSON.parse(readFileSync(canonicalPaths.contractJson(zeusConfigDirName, cleanContractName(contract.contract)), 'utf-8')) as ForgeSolidityMetadata;
                            return [contract.contract, metadata];
                        }));
            
                        const onchainHashes = Object.fromEntries(await Promise.all(deployedContracts._.contracts.map(async contract => {
                            try {
                                const bytecode = await publicClient.getCode({
                                    address: contract.address,
                                })
                                if (!bytecode) {
                                    console.warn(`Failed to compute onchain hash of ${contract.contract}@${contract.address}: failed to get code.`)
                                    return [contract.contract, undefined];
                                }
            
                                onchainBytecode[contract.contract] = bytecode;
                                const hash = computeFairHash(bytecode, contractMetadata[contract.contract]);
                                return [contract.contract, hash]
                            } catch (e) {
                                console.warn(`Failed to compute onchain hash of ${contract.contract}@${contract.address}`)
                                console.warn(e);
                                return [contract.contract, undefined];
                            }
                        })))
            
                        const localBytecode: Record<string, `0x${string}`> = {};
                        const localBytecodeHashes = Object.fromEntries(prep.deployedContracts?.map(contract => {
                            try {
                                const trace = getTrace(prep.output, contract.address);
                                if (!trace || !trace.trace.output) {
                                    console.warn(`Failed to find trace for contract creation simulation.`);
                                    return undefined;
                                }
                                localBytecode[contract.contract] = trace.trace.output as `0x${string}`;
                                const bytecodeHash = computeFairHash(trace.trace.output as `0x${string}`, contractMetadata[contract.contract]);
                                return [contract.contract, bytecodeHash] as [string, `0x${string}`]
                            } catch (e) {
                                console.warn(`Failed to compute bytecode hash of ${contract}`)
                                console.error(e);
                                return undefined;
                            }
                        }).filter(v => !!v) ?? []);
            
                        const contracts = deployedContracts._.contracts;
                        const instanceCounter: Record<string, number> = {};
                        const info = Object.fromEntries(contracts.map((ctr) => {
                            const instancedContractName = `${ctr.contract}${instanceCounter[ctr.contract] ? `_${instanceCounter[ctr.contract]}` : ``}`
                            instanceCounter[ctr.contract] = (instanceCounter[ctr.contract] ?? 0) + 1;
                            return [instancedContractName, {
                                ...ctr,
                                yours: localBytecodeHashes[ctr.contract] ?? '<none>',
                                onchain: onchainHashes[ctr.contract] ?? '<none>',
                                match: !!((localBytecodeHashes[ctr.contract] === onchainHashes[ctr.contract]) && localBytecodeHashes[ctr.contract]),
                            }]
                        }))
            
                        const failures = Object.keys(info).filter(ctr => !info[ctr].match)
                        const isFailure = Object.keys(failures).length > 0;
                        if (isFailure) {
                            console.error(`FATAL: Bytecode Hashes did not match for the following contracts;`)
                            console.table(failures.map(key => {
                                return {
                                    contract: info[key].contract,
                                    address: info[key].address,
                                    yours: shortenHex(info[key].yours),
                                    onchain: shortenHex(info[key].onchain),
                            }}));
            
                            console.log('Local bytecode keys', Object.keys(localBytecode));
                            console.log('Onchain bytecode keys', Object.keys(onchainBytecode));
                            failures.forEach(key => {
                                const ctr = info[key].contract;
                                console.log(chalk.bold.underline(`[${ctr}@${info[key].address}] Remote Bytecode (mismatches highlighted red):`))
            
                                const localBytes = hexToBytes(localBytecode[ctr]);
                                const remoteBytes = hexToBytes(onchainBytecode[ctr]);
            
                                remoteBytes.forEach((remoteByte, i) => {
                                    if (localBytes[i] !== remoteByte) {
                                        process.stdout.write(chalk.bgWhite.red(toHex(remoteByte).substring(2)));
                                    } else {
                                        process.stdout.write(chalk.gray(toHex(remoteByte).substring(2)));
                                    }
                                });
                                console.log();
                            });
            
                            console.error(`You may: (1) be on the wrong commit, (2) have a dirty local copy, or (3) have witnessed a mistake your teammate made on the other end.`)
                            console.error(`Please flag this, and consider cancelling your other deploy.`)
                        }
            
                        console.log(chalk.bold(`Validated contracts:`));
                        console.log(chalk.italic(`------------------------------------------------------------`));
                        console.log(chalk.italic(`\t${chalk.green('✔')} - the hash of the local compiled contract matched the onchain version`));
                        console.log(chalk.italic(`\t${chalk.red('x')} - the hash of the local compiled contract did not match the onchain version`));
                        console.log(chalk.italic(`NOTE: Zeus zeros-out any immutableReferences in the contract, to avoid runtime parameters which cannot be simulated.`))
                        console.log(chalk.italic(`------------------------------------------------------------`));
                        console.log();
            
                        Object.keys(info).forEach(ctr => {
                            const contractInfo = info[ctr];
                            const metaContract = deployedContracts._.contracts.find(_contract => _contract.address === contractInfo.address);
                            if (!metaContract) {
                                console.log(`No metadata on contract ${ctr} available.`);
                                return;
                            }
                            metaContract.validations = [
                                ...(metaContract.validations ?? []),
                                {
                                    by: currentUser(),
                                    valid: contractInfo.match,
                                    expectedBytecodeHash: !contractInfo.match ? contractInfo.yours : undefined
                                }
                            ]
            
                            if (contractInfo.match) {
                                console.log(`${chalk.green('✔')} ${ctr} (${contractInfo.address})`);
                            } else {
                                console.log(`${chalk.red('x')} ${ctr} (${contractInfo.address})`);
                            }
                        })
            
                        if (Object.keys(isFailure).length === 0) {
                            console.log(chalk.green('OK'));
                        } else {
                            console.log(chalk.red(`FAILURE`));
                            throw new Error(`Deployed contracts did not match local copy.`)
                        }
                    }
                    break;
                }
                case 'multisig': {
                    const multisigRun = await metatxn.getJSONFile<TGnosisRequest>(canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: deploy._.segmentId}))
                    const proposedTxHash = multisigRun._.safeTxHash;
                    const signer = multisigRun._.senderAddress;
                    const strategy = new GnosisEOAApiStrategy(deploy, metatxn, {nonInteractive: false, simulationAddress: signer, defaultArgs: {rpcUrl: customRpcUrl, etherscanApiKey: false}});
                    
                    if (proposedTxHash) {
                        // allow verifying the multisig txn hash.
                        console.log(chalk.bold(`This deploy has a multisig step ongoing. Checking that the provided gnosisHash matches the local copy.`))

                        const script = join(deploy._.upgradePath, deploy._.segments[deploy._.segmentId].filename);
                        const request = await strategy.prepare(script);
                        const gnosisTxnHash = (request as TGnosisRequest).safeTxHash;

                        if (proposedTxHash === gnosisTxnHash) {
                            console.log(`${chalk.green('✔')} ${script} (${gnosisTxnHash})`);
                        } else {
                            console.error(`${chalk.red('x')} ${script} (local=${gnosisTxnHash},reported=${proposedTxHash})`);
                            throw new Error(`Multisig transaction did not match (local=${gnosisTxnHash},reported=${proposedTxHash})`);
                        }
                    } else {
                        console.info(chalk.italic(`[${i+1}] step has not yet proposed a transaction. Nothing to validate.`))
                    }

                    break;
                }
            }
        }
    } catch (e) {
        console.error(`Failed to verify deploy.`);
        throw e;
    }
}

const cmd = command({
    name: 'verify',
    description: '',
    version: '1.0.0',
    args: {
        env: allArgs.env,
        json,
        deploy: allArgs.deploy
    },
    handler: requires(handler, withHost),
})

export default cmd;
