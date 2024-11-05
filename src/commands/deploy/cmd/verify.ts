import { command } from "cmd-ts";
import {json} from '../../args';
import * as allArgs from '../../args';
import { assertLoggedIn, inRepo, loggedIn, requires, TState } from "../../inject";
import { loadExistingEnvs } from "../../env/cmd/list";
import { execSync } from "child_process";
import ora from "ora";
import { pickStrategy, rpcUrl } from "../../prompts";
import { getActiveDeploy } from "./utils";
import * as AllChains from "viem/chains";
import { canonicalPaths } from "../../../metadata/paths";
import { TForgeRequest } from "../../../signing/strategy";
import { ForgeSolidityMetadata, TDeployedContractsManifest } from "../../../metadata/schema";
import { createPublicClient, hexToBytes, http, toHex } from "viem";
import { join } from "path";
import { computeFairHash } from "../utils";
import { getTrace } from "../../../signing/utils";
import chalk from "chalk";
import { readFileSync } from "fs";
import { getRepoRoot } from "../../configs";

const currentUser = () => execSync('git config --global user.email').toString('utf-8').trim();

const getChain = (chainId: number) => {
    const chain = Object.values(AllChains).find(value => value.id === chainId);
    if (!chain) {
        throw new Error(`Unsupported chain ${chainId}`);
    }
    return chain;
}

const shortenHex = (str: string) => {
    return str.substring(0, 5) + '...' + str.substring(str.length - 4);
}

async function handler(_user: TState, args: {env: string}) {
    const user = assertLoggedIn(_user);
    const metatxn = await user.metadataStore.begin();
    const envs = await loadExistingEnvs(metatxn);
    if (!envs.find(e => e.name === args.env)) {
        console.error(`No such environment: ${args.env}`);
        return;
    }

    const deploy = await getActiveDeploy(metatxn, args.env);
    if (!deploy) {
        console.error(`No active deploy to verify.`);
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

    const strategyId = await pickStrategy([
        {id: 'eoa', description: 'Private Key'},
        {id: 'ledger', description: 'Ledger'}
    ]);

    const strategy = await (async () => {
        const all = await import('../../../signing/strategies/strategies');
        const strategy = all.all.find(s => new s(deploy, metatxn).id === strategyId);
        if (!strategy) {
            throw new Error(`Unknown strategy`);
        }
        return new strategy(deploy, metatxn);
    })();

    const eoaPhases = deploy._.segments.filter(segment => segment.id <= deploy._.segmentId)
    if (!eoaPhases) {
        console.error(`Failed to find any contract deployments.`);
        return;
    }

    const script = join(deploy._.upgradePath, deploy._.segments[eoaPhases[0].id].filename);
    const prep = await strategy.prepare(script, deploy._) as TForgeRequest;
    if (!prep.deployedContracts || !prep.forge) {
        console.error(`This deploy isn't supposed to produce any contracts.`);
        // TODO: validate that no contracts were deployed in this phase.
        return;
    }

    if (deployedContracts._?.contracts?.length && deployedContracts._?.contracts?.length > 0) {
        const chain = getChain(deploy._.chainId);
        const publicClient = createPublicClient({chain, transport: http(customRpcUrl)})
        const onchainBytecode: Record<string, `0x${string}`> = {};

        const contractMetadata = Object.fromEntries(deployedContracts._.contracts.map(contract => {
            const metadata = JSON.parse(readFileSync(canonicalPaths.contractJson(getRepoRoot(), contract.contract), 'utf-8')) as ForgeSolidityMetadata;
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
        const localBytecodeHashes = Object.fromEntries(prep.deployedContracts.map(contract => {
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
        }).filter(v => !!v));

        // TODO: this doesn't take into account instances (keying on the contract name is basically always wrong)
        const contracts = deployedContracts._.contracts;
        const info = Object.fromEntries(contracts.map((ctr) => [ctr.contract, {
            ...ctr,
            yours: localBytecodeHashes[ctr.contract] ?? '<none>',
            onchain: onchainHashes[ctr.contract] ?? '<none>',
            match: !!((localBytecodeHashes[ctr.contract] === onchainHashes[ctr.contract]) && localBytecodeHashes[ctr.contract]),
        }]))

        const isFailure = Object.keys(info).filter(ctr => !info[ctr].match)
        if (isFailure && Object.keys(isFailure).length > 0) {
            console.error(`FATAL: Bytecode Hashes did not match for the following contracts;`)
            console.table(isFailure.map(key => {
                return {
                    contract: info[key].contract,
                    address: info[key].address,
                    yours: shortenHex(info[key].yours),
                    onchain: shortenHex(info[key].onchain),
            }}));

            console.log('Local bytecode keys', Object.keys(localBytecode));
            console.log('Onchain bytecode keys', Object.keys(onchainBytecode));
            isFailure.forEach(key => {
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
        }

        await deployedContracts.save();
        await metatxn.commit(`[${args.env}] verify deploy ${deploy._.name} - ${isFailure ? 'failure' : 'success'}`)
    }
}

const cmd = command({
    name: 'verify',
    description: '',
    version: '1.0.0',
    args: {
        env: allArgs.env,
        json,
    },
    handler: requires(handler, inRepo, loggedIn),
})

export default cmd;
