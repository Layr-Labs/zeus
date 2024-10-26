import { canonicalPaths } from "../../../metadata/paths";
import { TDeployManifest, TDeployPhase, TSegmentType } from "../../../metadata/schema";
import { TDeploy } from "../../../metadata/schema";
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";
import { all } from "../../../signing/strategies/strategies";
import { pickStrategy } from "../../prompts";

export const advanceSegment = async (deploy: SavebleDocument<TDeploy>) => {
    const hasNextSegment = deploy._.segments[deploy._.segmentId+1] !== undefined;
    if (!hasNextSegment) {
        deploy._.phase = 'complete';
        return;
    }

    deploy._.segmentId++;
    if (deploy._.segments[deploy._.segmentId]?.type === "eoa") {
        deploy._.phase = "eoa_start";
    } else if (deploy._.segments[deploy._.segmentId]?.type === "multisig") {
        deploy._.phase = "multisig_start";
    } else {
        throw new Error(`failed to advance deploy.`);
    }
}

export const advance = async (deploy: SavebleDocument<TDeploy>) => {
    const before = `${deploy._.segmentId}::${deploy._.phase}`
    try {
        switch (deploy._.phase) {
            case "":
                deploy._.segmentId = -1; // set back to -1.
                advanceSegment(deploy);
                break;
            case "eoa_start":
                deploy._.phase = "eoa_wait_confirm";
                break;
            case "eoa_wait_confirm":
                advanceSegment(deploy);
                break;
            case "multisig_start":
                deploy._.phase = "multisig_wait_signers";
                break;
            case "multisig_wait_signers":
                deploy._.phase = "multisig_execute";
                break;
            case "multisig_execute":
                deploy._.phase = "multisig_wait_confirm";
                break;
            case "multisig_wait_confirm":
                await advanceSegment(deploy);
                break;
            case "complete":
            case "cancelled":
                // nothing to advance
                break;
            default:
                throw new Error(`Deploy in unknown phase: ${deploy._.phase}`);
        }
    } finally {
        const after = `${deploy._.segmentId}::${deploy._.phase}`
        console.log(`Advancing deploy: ${before} -> ${after}`);
        await deploy.save();
    }
}

export function isTerminalPhase(state: TDeployPhase): boolean {
    return state === "complete" || state === "cancelled";
}

export const supportedSigners: Record<TSegmentType, string[]> = {
    "eoa": ["eoa", "ledger"],
    "multisig": ["gnosis.eoa", "gnosis.ledger"],
}

export const promptForStrategy = async (deploy: SavebleDocument<TDeploy>, txn: Transaction, overridePrompt?: string) => {
    const segment = deploy._.segments[deploy._.segmentId];
    const supportedStrategies = supportedSigners[segment.type]
        .filter(strategyId => {
            return !!all.find(s => new s(deploy, txn!).id === strategyId);
        })
        .map(strategyId => {
            const strategyClass = all.find(s => new s(deploy, txn!).id === strategyId);
            return new strategyClass!(deploy, txn!);
        });
    const strategyId = await pickStrategy(supportedStrategies, overridePrompt)      
    return supportedStrategies.find(s => s.id === strategyId)!;      
}

export const updateLatestDeploy = async (metadata: Transaction, env: string, deployName: string | undefined, forceOverride = false) => {
    const deployManifestPath = canonicalPaths.deploysManifest(env);
    const deployManifest = await metadata.getJSONFile<TDeployManifest>(deployManifestPath);
    if (deployManifest?._.inProgressDeploy && !forceOverride) {
        throw new Error('unexpected - deploy already in progress.');
    }    
    deployManifest!._.inProgressDeploy = deployName;
    await deployManifest!.save();
}

export async function getActiveDeploy(metadata: Transaction, env: string): Promise<SavebleDocument<TDeploy> | undefined> {
    const aggregateDeployManifest = await metadata.getJSONFile<TDeployManifest>(
        canonicalPaths.deploysManifest(env)
    );
    if (aggregateDeployManifest?._.inProgressDeploy) {
        const deployName = aggregateDeployManifest!._.inProgressDeploy;
        return await metadata.getJSONFile<TDeploy>(
            canonicalPaths.deployStatus({env, name: deployName})
        );
    }
}