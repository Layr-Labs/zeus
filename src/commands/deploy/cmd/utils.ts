import { canonicalPaths } from "../../../metadata/paths";
import { Segment, TDeployManifest, TDeployPhase } from "../../../metadata/schema";
import { TDeploy } from "../../../metadata/schema";
import { SavebleDocument, Transaction } from "../../../metadata/metadataStore";

import * as AllChains from "viem/chains";
import { execSync } from "child_process";

export const advanceSegment = async (deploy: SavebleDocument<TDeploy>) => {
    const hasNextSegment = deploy._.segments[deploy._.segmentId+1] !== undefined;
    if (!hasNextSegment) {
        deploy._.phase = 'complete';
        return;
    }

    deploy._.segmentId++;
    if (deploy._.segments[deploy._.segmentId]?.type === "eoa") {
        deploy._.phase = "eoa_validate";
    } else if (deploy._.segments[deploy._.segmentId]?.type === "multisig") {
        deploy._.phase = "multisig_start";
    } else if (deploy._.segments[deploy._.segmentId]?.type === "script") {
        deploy._.phase = "script_run";
    } else {
        throw new Error(`failed to advance deploy.`);
    }
}

export const advance = async (deploy: SavebleDocument<TDeploy>) => {
    try {
        switch (deploy._.phase) {
            case "":
                deploy._.segmentId = -1; // set back to -1.
                advanceSegment(deploy);
                break;
            case "eoa_validate":
                deploy._.phase = "eoa_start";
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
            case "script_run":
                await advanceSegment(deploy);
                break;
            case "complete":
            case "cancelled":
            case "failed":
                // nothing to advance
                break;
            default:
                throw new Error(`Deploy in unknown phase: ${deploy._.phase}`);
        }
    } finally {
        await deploy.save();
    }
}

export function isTerminalPhase(state: TDeployPhase): boolean {
    return state === "complete" || state === "cancelled" || state == "failed";
}

type TPhaseType = "multisig" | "eoa" | "script" | "system";

export const cleanContractName = (contractName: string) => {
    if (contractName.endsWith('_Impl')) {
        return contractName.substring(0, contractName.length - `_Impl`.length);
    } else if (contractName.endsWith('_Proxy')) {
        return contractName.substring(0, contractName.length - `_Proxy`.length);
    } else if (contractName.endsWith('_Beacon')) {
        return contractName.substring(0, contractName.length - `_Beacon`.length);
    }

    return contractName;
}
export const currentUser = () => execSync('git config --global user.email').toString('utf-8').trim();

export const blankDeploy = (args: {env: string, chainId: number, upgrade: string, upgradePath: string, name: string, segments: Segment[]}) => {
    const start = new Date();
    const deploy: TDeploy = {
        name: args.name,
        env: args.env,
        segmentId: 0,
        segments: args.segments,
        metadata: [],
        upgrade: args.upgrade,
        upgradePath: args.upgradePath,
        phase: "" as TDeployPhase,
        chainId: args.chainId,
        startTime: start.toString(),
        startTimestamp: start.getTime() / 1000,
    };
    return deploy;
}

export const sleepMs = (timeMs: number) => new Promise((resolve) => setTimeout(resolve, timeMs))

export function formatNow() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}-${hours}-${minutes}`;
}

export const getChain = (chainId: number) => {
    if (chainId === -1) {
        return AllChains.anvil;
    }
    const chain = Object.values(AllChains).find(value => value.id === chainId);
    if (!chain) {
        throw new Error(`Unsupported chain ${chainId}`);
    }
    return chain;
}

export function phaseType(state: TDeployPhase): TPhaseType {
    switch (state) {
        case "eoa_validate": 
        case "eoa_start":
        case "eoa_wait_confirm":
            return "eoa";
        case "multisig_start":
        case "multisig_wait_signers":
        case "multisig_execute":
        case "multisig_wait_confirm":
            return "multisig";
        case "script_run":
            return "script";
        case "complete":
        case "cancelled":
        case "failed":
        case "":
            return "system"
    }
}


export const updateLatestDeploy = async (metadata: Transaction, env: string, deployName: string | undefined, forceOverride = false) => {
    const deployManifestPath = canonicalPaths.deploysManifest(env);
    const deployManifest = await metadata.getJSONFile<TDeployManifest>(deployManifestPath);
    if (deployManifest?._.inProgressDeploy && !forceOverride) {
        throw new Error('unexpected - deploy already in progress.');
    }    
    deployManifest._.inProgressDeploy = deployName;
    await deployManifest.save();
}

export async function getActiveDeploy(metadata: Transaction, env: string): Promise<SavebleDocument<TDeploy> | undefined> {
    const aggregateDeployManifest = await metadata.getJSONFile<TDeployManifest>(
        canonicalPaths.deploysManifest(env)
    );
    if (aggregateDeployManifest?._.inProgressDeploy) {
        const deployName = aggregateDeployManifest._.inProgressDeploy;
        return await metadata.getJSONFile<TDeploy>(
            canonicalPaths.deployStatus({env, name: deployName})
        );
    }
}