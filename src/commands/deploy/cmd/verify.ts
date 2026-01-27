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
import { join } from "path";
import { computeFairHash } from "../utils";
import { getTrace, TForgeRun } from "../../../signing/utils";
import chalk from "chalk";
import { readFileSync } from "fs";
import { configs } from "../../configs";

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

export async function handler(_user: TState, args: {env: string, deploy: string | undefined, continueOnFailure: boolean}) {
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
        
        const stepFailures: Error[] = [];
        const allContracts = deployedContracts._?.contracts ?? [];
        const getSegmentContracts = (segmentId: number) => allContracts.filter((contract) => contract.lastUpdatedIn.segment === segmentId);
        const formatErrorForLog = (err: unknown) => {
            if (err instanceof Error) {
                if (err.message && err.message !== '[object Object]') {
                    return err.message;
                }
                try {
                    const serialized = JSON.stringify(err, Object.getOwnPropertyNames(err));
                    if (serialized && serialized !== '{}' && serialized !== '[object Object]') {
                        return serialized;
                    }
                } catch {
                    // ignore serialization errors
                }
                return err.stack ?? err.toString();
            }
            if (typeof err === 'string') {
                return err;
            }
            try {
                return JSON.stringify(err);
            } catch {
                return String(err);
            }
        };

        const getContractMetadataCandidates = async (contractName: string) => {
            const zeusConfigDirName = await configs.zeus.dirname();
            const tryRead = (name: string) =>
                JSON.parse(readFileSync(canonicalPaths.contractJson(zeusConfigDirName, name), 'utf-8')) as ForgeSolidityMetadata;

            const candidates = [contractName];
            if (contractName.endsWith('_Proxy')) {
                candidates.push('ERC1967Proxy', 'BeaconProxy', 'Proxy');
            }
            if (contractName.endsWith('_Beacon')) {
                candidates.push('UpgradeableBeacon');
            }
            candidates.push(cleanContractName(contractName));

            const results: ForgeSolidityMetadata[] = [];
            let lastError: unknown;
            for (const candidate of candidates) {
                try {
                    results.push(tryRead(candidate));
                } catch (e) {
                    lastError = e;
                }
            }

            if (results.length === 0) {
                throw lastError ?? new Error(`Missing contract metadata for ${contractName}`);
            }

            return results;
        };

        const loadContractMetadata = async (contractName: string) => {
            const candidates = await getContractMetadataCandidates(contractName);
            return candidates[0];
        };

        const verifySegmentContracts = async (
            segmentId: number,
            output: TForgeRequest["output"] | undefined,
            localContracts: TForgeRequest["deployedContracts"] | undefined,
        ) => {
            const segmentContracts = getSegmentContracts(segmentId);
            if (!segmentContracts || segmentContracts.length === 0) {
                if (localContracts && localContracts.length > 0) {
                    console.warn(`Step ${segmentId + 1}: local copy deployed contracts, but none were recorded remotely.`);
                } else {
                    console.log(`${segmentId + 1}: no contracts deployed.`);
                }
                return;
            }

            if (!localContracts || localContracts.length === 0 || !output) {
                console.error(`The local copy didn't produce any contracts, but the remote claimed to produce the following contracts.`);
                console.table(segmentContracts);
                console.error(`Make sure you're on the correct commit, and double check any deployed contracts before proceeding...`);
                return;
            }

            const chain = getChain(deploy._.chainId);
            const publicClient = createPublicClient({chain, transport: http(customRpcUrl)})
            const onchainBytecode: Record<string, `0x${string}`> = {};

            const contractMetadata = Object.fromEntries(await Promise.all(segmentContracts.map(async contract => {
                const metadata = await loadContractMetadata(contract.contract);
                return [contract.contract, metadata];
            })));

            const onchainHashes = Object.fromEntries(await Promise.all(segmentContracts.map(async contract => {
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
            const unverifiableContracts = new Set<string>();
            const localBytecodeHashEntries: [string, `0x${string}`][] = [];
            for (const contract of (localContracts ?? [])) {
                try {
                    const trace = getTrace(output, contract.address);
                    if (!trace || !trace.trace.output) {
                        const onchainHex = onchainBytecode[contract.contract];
                        if (onchainHex) {
                            const candidates = await getContractMetadataCandidates(contract.contract);
                            for (const candidate of candidates) {
                                const localHash = computeFairHash(candidate.deployedBytecode.object, candidate);
                                const onchainHash = computeFairHash(onchainHex, candidate);
                                if (localHash === onchainHash) {
                                    console.warn(`Missing trace for ${contract.contract}; matched bytecode against local artifacts.`);
                                    localBytecode[contract.contract] = candidate.deployedBytecode.object as `0x${string}`;
                                    onchainHashes[contract.contract] = onchainHash;
                                    localBytecodeHashEntries.push([contract.contract, localHash]);
                                    break;
                                }
                            }
                            if (localBytecodeHashEntries.some(([name]) => name === contract.contract)) {
                                continue;
                            }
                        }
                        const metadata = contractMetadata[contract.contract];
                        if (metadata?.deployedBytecode?.object) {
                            console.warn(`Missing trace for ${contract.contract}; falling back to local artifact bytecode.`);
                            localBytecode[contract.contract] = metadata.deployedBytecode.object as `0x${string}`;
                            const bytecodeHash = computeFairHash(metadata.deployedBytecode.object, metadata);
                            localBytecodeHashEntries.push([contract.contract, bytecodeHash]);
                            if (contract.contract.endsWith('_Proxy')) {
                                unverifiableContracts.add(contract.contract);
                            }
                            continue;
                        }
                        const recorded = segmentContracts.find(segmentContract =>
                            segmentContract.address.toLowerCase() === contract.address.toLowerCase()
                        );
                        if (recorded?.deployedBytecodeHash) {
                            console.warn(`Missing trace for ${contract.contract}; using recorded deployed bytecode hash.`);
                            localBytecodeHashEntries.push([contract.contract, recorded.deployedBytecodeHash]);
                            continue;
                        }
                        console.warn(`Failed to find trace for contract creation simulation and no local bytecode available.`);
                        continue;
                    }
                    localBytecode[contract.contract] = trace.trace.output as `0x${string}`;
                    const bytecodeHash = computeFairHash(trace.trace.output as `0x${string}`, contractMetadata[contract.contract]);
                    localBytecodeHashEntries.push([contract.contract, bytecodeHash]);
                } catch (e) {
                    console.warn(`Failed to compute bytecode hash of ${contract}`)
                    console.error(e);
                }
            }
            const localBytecodeHashes = Object.fromEntries(localBytecodeHashEntries);

            const contracts = segmentContracts;
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

            const failures = Object.keys(info).filter(ctr => !info[ctr].match && !unverifiableContracts.has(info[ctr].contract))
            const unverifiable = Object.keys(info).filter(ctr => unverifiableContracts.has(info[ctr].contract));
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

                    const localHex = localBytecode[ctr];
                    const remoteHex = onchainBytecode[ctr];
                    if (!localHex || !remoteHex) {
                        console.warn(`Missing bytecode for ${ctr}. local=${!!localHex}, onchain=${!!remoteHex}`);
                        return;
                    }

                    const localBytes = hexToBytes(localHex);
                    const remoteBytes = hexToBytes(remoteHex);

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

            if (unverifiable.length > 0) {
                console.warn(`Skipped strict verification for proxy contracts without traces (multisig-deployed):`);
                console.table(unverifiable.map(key => {
                    return {
                        contract: info[key].contract,
                        address: info[key].address,
                        yours: shortenHex(info[key].yours),
                        onchain: shortenHex(info[key].onchain),
                    };
                }));
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
                const metaContract = segmentContracts.find(_contract => _contract.address === contractInfo.address);
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

            if (!isFailure) {
                console.log(chalk.green('OK'));
            } else {
                console.log(chalk.red(`FAILURE`));
                const err = new Error(`Step ${segmentId + 1}: deployed contracts did not match local copy.`);
                if (!args.continueOnFailure) {
                    throw err;
                }
                stepFailures.push(err);
            }
        };

        const verifySegmentContractsFromArtifacts = async (segmentId: number) => {
            const segmentContracts = getSegmentContracts(segmentId);
            if (!segmentContracts || segmentContracts.length === 0) {
                console.log(`${segmentId + 1}: no contracts deployed.`);
                return;
            }

            const chain = getChain(deploy._.chainId);
            const publicClient = createPublicClient({chain, transport: http(customRpcUrl)})
            const onchainBytecode: Record<string, `0x${string}`> = {};

            const contractMetadata = Object.fromEntries(await Promise.all(segmentContracts.map(async contract => {
                const metadata = await loadContractMetadata(contract.contract);
                return [contract.contract, metadata];
            })));

            const onchainHashes = Object.fromEntries(await Promise.all(segmentContracts.map(async contract => {
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
            const localBytecodeHashes = Object.fromEntries(segmentContracts.map(contract => {
                try {
                    const metadata = contractMetadata[contract.contract];
                    if (!metadata?.deployedBytecode?.object) {
                        console.warn(`Missing deployedBytecode for ${contract.contract}; cannot validate locally.`);
                        return undefined;
                    }
                    localBytecode[contract.contract] = metadata.deployedBytecode.object as `0x${string}`;
                    const bytecodeHash = computeFairHash(metadata.deployedBytecode.object, metadata);
                    return [contract.contract, bytecodeHash] as [string, `0x${string}`];
                } catch (e) {
                    console.warn(`Failed to compute local bytecode hash of ${contract.contract}`)
                    console.error(e);
                    return undefined;
                }
            }).filter(v => !!v) as [string, `0x${string}`][]);

            const instanceCounter: Record<string, number> = {};
            const info = Object.fromEntries(segmentContracts.map((ctr) => {
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

                const localHex = localBytecode[ctr];
                const remoteHex = onchainBytecode[ctr];
                if (!localHex || !remoteHex) {
                    console.warn(`Missing bytecode for ${ctr}. local=${!!localHex}, onchain=${!!remoteHex}`);
                    return;
                }

                const localBytes = hexToBytes(localHex);
                const remoteBytes = hexToBytes(remoteHex);

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
                const metaContract = segmentContracts.find(_contract => _contract.address === contractInfo.address);
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

            if (!isFailure) {
                console.log(chalk.green('OK'));
            } else {
                console.log(chalk.red(`FAILURE`));
                const err = new Error(`Step ${segmentId + 1}: deployed contracts did not match local copy.`);
                if (!args.continueOnFailure) {
                    throw err;
                }
                stepFailures.push(err);
            }
        };

        for (let i = 0; i <= deploy._.segmentId; i++) {
            console.log(`Verifying deploy: step (${i+1}/${deploy._.segmentId+1})...`)
            const segment = deploy._.segments[i];
            const script = join(deploy._.upgradePath, deploy._.segments[i].filename);

            try {
                switch (segment.type) {
                case 'eoa': {
                    // get all signers.
                    const segmentContracts = getSegmentContracts(i);
                    const signers = segmentContracts.map(contract => contract.lastUpdatedIn.signer);
                    if (!signers || signers.length == 0) {
                        console.log(`${i+1}: no contracts deployed.`);
                        continue;
                    }

                    let recordedRun: TForgeRun | undefined;
                    try {
                        const foundryRun = await metatxn.getJSONFile<TForgeRun>(canonicalPaths.foundryRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: i}));
                        recordedRun = foundryRun?._;
                    } catch {
                        recordedRun = undefined;
                    }
                    
                    if (recordedRun?.traces?.length) {
                        console.log(chalk.bold(`Using recorded forge output for bytecode validation.`))
                        await verifySegmentContracts(i, recordedRun, segmentContracts);
                    } else {
                        console.warn(`Recorded forge output missing; validating bytecode from local artifacts.`)
                        await verifySegmentContractsFromArtifacts(i);
                    }
                    break;
                }
                case 'multisig': {
                    const multisigRun = await metatxn.getJSONFile<TGnosisRequest>(canonicalPaths.multisigRun({deployEnv: deploy._.env, deployName: deploy._.name, segmentId: i}))
                    const proposedTxHash = multisigRun._.safeTxHash;
                    const segmentContracts = getSegmentContracts(i);

                    if (segmentContracts.length > 0) {
                        if (proposedTxHash) {
                            console.log(chalk.bold(`Multisig step found an onchain proposal. Skipping dry-run and validating bytecode from recorded output.`))
                        }
                        const recordedOutput = (multisigRun._ as TGnosisRequest & { output?: TForgeRequest["output"] }).output;
                        const recordedContracts = (multisigRun._ as TGnosisRequest).deployedContracts;
                        if (recordedOutput && recordedContracts && recordedContracts.length > 0) {
                            await verifySegmentContracts(i, recordedOutput, recordedContracts);
                        } else {
                            console.warn(`Multisig step missing recorded output; validating bytecode from local artifacts instead.`)
                            await verifySegmentContractsFromArtifacts(i);
                        }
                        break;
                    }

                    if (proposedTxHash) {
                        // No contracts for this step; avoid running execute() which may revert on already-scheduled ops.
                        console.log(chalk.bold(`Multisig step has no deployed contracts. Safe tx hash recorded: ${proposedTxHash}`))
                    } else {
                        console.info(chalk.italic(`[${i+1}] step has not yet proposed a transaction. Nothing to validate.`))
                    }
                    break;
                }
            }
            } catch (e) {
                const errMessage = formatErrorForLog(e);
                const err = e instanceof Error ? e : new Error(errMessage);
                if (!args.continueOnFailure) {
                    throw err;
                }
                stepFailures.push(new Error(`Step ${i+1}: ${errMessage}`));
                console.error(`Step ${i+1} failed, continuing to next step...`);
            }
        }

        if (args.continueOnFailure && stepFailures.length > 0) {
            console.error(`Verification completed with ${stepFailures.length} failing step(s):`);
            stepFailures.forEach((err) => console.error(`- ${formatErrorForLog(err)}`));
            return;
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
        deploy: allArgs.deploy,
        continueOnFailure: allArgs.continueOnFailure,
    },
    handler: requires(handler, withHost),
})

export default cmd;
