import chalk from "chalk";
import { advance, updateLatestDeploy } from "../../commands/deploy/cmd/utils";
import { SavebleDocument, Transaction } from "../../metadata/metadataStore";
import { canonicalPaths } from "../../metadata/paths";
import { TDeploy, TDeployedContractsManifest, TDeployStateMutations, TEnvironmentManifest, TUpgrade } from "../../metadata/schema";
import { HaltDeployError, PauseDeployError, TStrategyOptions } from "../../signing/strategy";
import { PhaseTypeHandler } from "./base";

const sleep = async (timeoutMs: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, timeoutMs);
    });
}

export async function executeSystemPhase(deploy: SavebleDocument<TDeploy>, metatxn: Transaction, _options: TStrategyOptions): Promise<void> {
    const waitIfAnvil = async () => {
        if (_options.defaultArgs?.anvil !== undefined) {
            console.log(`This deploy created a local anvil instance. Waiting for CTRL-C to close.`);
            chalk.bold(`   http://127.0.0.1:8546/\n`)
            while(true) {
                await sleep(3000);
            }
        }
    }
    switch (deploy._.phase) {
        case "":
            await advance(deploy);
            await deploy.save()
            await updateLatestDeploy(metatxn, deploy._.env, deploy._.name);
            break;
        case "complete": {
            const envManifest = await metatxn.getJSONFile<TEnvironmentManifest>(canonicalPaths.environmentManifest(deploy._.env));
            if (!envManifest || !envManifest._ || !envManifest._.id) {
                console.error(`Corrupted env manifest.`);
                throw new HaltDeployError(deploy, `Corrupted env manifest.`);
            }

            const deployedEnvironmentMutations = await metatxn.getJSONFile<TDeployStateMutations>(canonicalPaths.deployStateMutations(deploy._));
            const deployParameters = await metatxn.getJSONFile<Record<string, unknown>>(canonicalPaths.deployParameters('', deploy._.env));

            if (deployedEnvironmentMutations._.mutations && deployedEnvironmentMutations._.mutations.length > 0) {
                console.log(chalk.bold.underline(`Updated environment constants:`));
                console.log();
                console.table(deployedEnvironmentMutations._.mutations.map(mut => {return {...mut, internalType: undefined}}));

                const mutations: Record<string, unknown> = Object.fromEntries(deployedEnvironmentMutations._.mutations.map((mutation) => {
                    return [mutation.name, mutation.next];
                }));

                deployParameters._ = {
                    ...(deployParameters._ ?? {}),
                    ...mutations
                };
                await deployParameters.save();
            }
            
            // update environment's latest deployed contracts.
            const deployedContracts = await metatxn.getJSONFile<TDeployedContractsManifest>(canonicalPaths.deployDeployedContracts(deploy._));
            if (deployedContracts._?.contracts?.length && deployedContracts._?.contracts?.length > 0) {
                if (!envManifest._.contracts) {
                    envManifest._.contracts = {static: {}, instances: []};
                }
                const deployedStatic = Object.fromEntries(deployedContracts._.contracts.filter(t => t.singleton).map(t => [t.contract, t]));
                const deployedInstances = deployedContracts._.contracts.filter(t => !t.singleton);

                const updatedStatics = Object.keys(deployedStatic)
                            .filter(contract => deployedStatic[contract].address !== envManifest._.contracts.static[contract]?.address)
                            .map(contract => {
                                return { 
                                    name: contract,
                                    prev: envManifest._.contracts.static[contract]?.address ?? '<none>',
                                    new: deployedStatic[contract].address
                                }
                            });
                    
                if (updatedStatics) {
                    console.log(chalk.bold.underline(`Updated static contracts:`))
                    console.log()
                    console.table(updatedStatics)
                    console.log()
                }

                envManifest._.contracts.static = {
                    ...envManifest._.contracts.static,
                    ...deployedStatic,
                }
                envManifest._.contracts.instances = [
                    ...(envManifest._.contracts.instances ?? []),
                    ...deployedInstances
                ];
            }

            console.log(`Deploy completed. ✅`);
            await updateLatestDeploy(metatxn, deploy._.env, undefined, true);

            const upgrade = await metatxn.getJSONFile<TUpgrade>(canonicalPaths.upgradeManifest(deploy._.upgrade));
            if (!upgrade) {
                throw new HaltDeployError(deploy, `No upgrade manifest for '${deploy._.upgrade}' found.`)
            }
            envManifest._.deployedVersion = upgrade._.to;
            envManifest._.latestDeployedCommit = upgrade._.commit;

            envManifest.save();
            deploy.save();
            await metatxn.commit(`Deploy ${deploy._.name} completed!`);
            await waitIfAnvil();
            throw new PauseDeployError(deploy, 'Deploy completed');
        }
        case "failed": {
            console.error(`The deploy failed. ❌`);
            await updateLatestDeploy(metatxn, deploy._.env, undefined, true);
            await metatxn.commit(`Deploy ${deploy._.name} failed.`);
            await waitIfAnvil();
            throw new PauseDeployError(deploy, 'Deploy failed');
        }
        case "cancelled":
            console.log(`Deploy was cancelled. ❌`);
            await updateLatestDeploy(metatxn, deploy._.env, undefined, true);
            await deploy.save();
            await metatxn.commit(`Deploy ${deploy._.name} cancelled.`);
            await waitIfAnvil();
            throw new PauseDeployError(deploy, 'Deploy cancelled.');
    }
}

const handler: PhaseTypeHandler = {
    execute: executeSystemPhase,
    cancel: async (deploy: SavebleDocument<TDeploy>, _metatxn: Transaction, _options: TStrategyOptions | undefined) => {
        switch (deploy._.phase) {
            case "complete":
                throw new Error(`Deploy is already completed. Resume (with zeus deploy run --resume) to clear out the deploy.`)
            case "cancelled":
                throw new Error(`Deploy is already cancelled. Resume (with zeus deploy run --resume) to clear out the deploy.`)
            case "failed":
                throw new Error(`Deploy is already failed. Resume (with zeus deploy run --resume) to clear out the deploy.`)
            case "":
                // deploy hasn't even begun. can be removed cleanly.
                return;
        }        
        
        return;
    }
}

export default handler;