import { TState } from "../../inject.js";
import { canonicalPaths } from "../../../metadata/paths.js";
import { TDeployManifest, TDeployPhase } from "../../../metadata/schema.js";
import { join } from "path";
import { TDeploy } from "../../../metadata/schema.js";

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
    const before = deploy.phase;
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
            advanceSegment(deploy);
            break;
        case "complete":
        case "cancelled":
            // nothing to advance
            break;
        default:
            throw new Error(`Deploy in unknown phase: ${deploy.phase}`);
    }
    console.log(`Updated phase: ${before ?? '<uninitialized>'} -> ${deploy.phase}`);
}

export function isTerminalPhase(state: TDeployPhase): boolean {
    return state === "complete" || state === "cancelled";
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