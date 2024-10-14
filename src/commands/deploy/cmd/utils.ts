import { TState } from "../../inject";
import { canonicalPaths } from "../../../metadata/paths";
import { TDeployManifest, TDeployPhase } from "../../../metadata/schema";
import { join } from "path";
import { TDeploy } from "../../../metadata/schema";
import chalk from "chalk";
import { MetadataStore } from "../../../metadata/metadataStore";

export const advanceSegment = (deploy: TDeploy) => {
    if (deploy.segments[deploy.segmentId]?.type === "eoa") {
        deploy.phase = "eoa_start";
    } else if (deploy.segments[deploy.segmentId]?.type === "multisig") {
        deploy.phase = "multisig_start";
    } else {
        deploy.phase = "complete";
    }
}

export const advance = (deploy: TDeploy) => {
    switch (deploy.phase) {
        case "":
            advanceSegment(deploy);
            break;
        case "eoa_start":
            deploy.phase = "eoa_wait_confirm";
            break;
        case "eoa_wait_confirm":
            // check what the next type is.    
            deploy.segmentId++;
            advanceSegment(deploy);
            break;
        case "multisig_start":
            deploy.phase = "multisig_wait_signers";
            break;
        case "multisig_wait_signers":
            deploy.phase = "multisig_execute";
            break;
        case "multisig_execute":
            deploy.phase = "multisig_wait_confirm";
            break;
        case "multisig_wait_confirm":
            deploy.segmentId++;
            advanceSegment(deploy);
            break;
        case "complete":
        case "cancelled":
            // nothing to advance
            break;
        default:
            throw new Error(`Deploy in unknown phase: ${deploy.phase}`);
    }
}

export function isTerminalPhase(state: TDeployPhase): boolean {
    return state === "complete" || state === "cancelled";
}

export const updateLatestDeploy = async (metadataStore: MetadataStore, env: string, deployName: string | undefined, forceOverride = false) => {
    const deployManifestPath = canonicalPaths.deploysManifest(env);
    const deployManifest = await metadataStore.getJSONFile<TDeployManifest>(deployManifestPath) ?? {};
    if (deployManifest.inProgressDeploy && !forceOverride) {
        throw new Error('unexpected - deploy already in progress.');
    }    
    deployManifest.inProgressDeploy = deployName;
    await metadataStore.updateJSON<TDeployManifest>(deployManifestPath, deployManifest!);
}

export async function getActiveDeploy(user: TState, env: string): Promise<TDeploy | undefined> {
    const aggregateDeployManifest = await user.metadataStore?.getJSONFile<TDeployManifest>(
        canonicalPaths.deploysManifest(env)
    );
    if (aggregateDeployManifest?.inProgressDeploy) {
        const deployName = aggregateDeployManifest!.inProgressDeploy;
        return await user.metadataStore!.getJSONFile<TDeploy>(
            join(
                canonicalPaths.deployDirectory('', env, deployName),
                "deploy.json"
            )
        )
    }
}