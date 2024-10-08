import { Octokit } from "octokit";
import { TState } from "../../inject.js";

// Current status, if applicable, of an ongoing deploy in this environment.
// - "" - the deploy has not started yet.
// - "create" -- [eoa] the `create` phase has been run and is submitted to the network.
//    * CLI should confirm that etherscan has ABIs for contracts.
// - "wait_create_confirm" -- we are waiting for the confirmation of the associated transactions from deploy.
// - "queue" - [requires ops multisig] the `queue` phase has been run and is awaiting submission.
// - "wait_queue_find_signers" - the `queue` transactions are awaiting multisig cosigners before being signed/executed.
// - "wait_queue_confirm" - the `queue` transactions have been signed and submitted to the network and are being awaited.
// - "await_queue_timelock" - execution is blocked on the timelock.
// - "execute" - `execute` phase has been run, and we are waiting for transactions to be submitted to the network.
// - "wait_execute_confirm" - transactions have been submitted to the network, and we are awaiting positive receipt and metadata.
// - "complete" - the upgrade has been fully applied, and all metadata is available.
// - "cancelled" - the upgrade was cancelled during the timelock phase, if applicable.
export type TDeployPhase = (
     "" |
     "create" | 
     "wait_create_confirm" | 
     "queue" | 
     "wait_queue_find_signers" | 
     "wait_queue_confirm" | 
     "wait_queue_timelock" | 
     "execute" | 
     "wait_execute_confirm" | 
     "complete" | 
     "cancelled"
)

// "skips" a phase, which 
export const skip = (deploy: TDeploy) => {
    switch (deploy.phase) {
        case "create":
        case "wait_create_confirm":
            deploy.phase = "queue";
            break;
        case "queue":
        case "wait_queue_find_signers":
        case "wait_queue_confirm":
        case "wait_queue_timelock":
            deploy.phase = "execute";
            break;
        case "execute":
            // TODO: this probably should throw
            deploy.phase = "cancelled";
            break;
        case "wait_execute_confirm":
            // TODO: this probably should throw
            deploy.phase = "complete";
            break;
        case "complete":
        case "cancelled":
            // nothing to advance
            break;
        case "":
            deploy.phase = "create";
            break;
        default:
            throw new Error(`Deploy in unknown phase: ${deploy.phase}`);
    }
}

export const advance = (deploy: TDeploy) => {
    switch (deploy.phase) {
        case "create":
            deploy.phase = "wait_create_confirm";
        case "wait_create_confirm":
            deploy.phase = "queue";
            break;
        case "queue":
            deploy.phase = "wait_queue_find_signers";
            break;
        case "wait_queue_find_signers":
            deploy.phase = "wait_queue_confirm";
            break;
        case "wait_queue_confirm":
            deploy.phase = "wait_queue_timelock";
            break;
        case "wait_queue_timelock":
            deploy.phase = "execute";
            break;
        case "execute":
            deploy.phase = "wait_execute_confirm";
            break;
        case "wait_execute_confirm":
            deploy.phase = "complete";
            break;
        case "complete":
        case "cancelled":
            // nothing to advance
            break;
        case "":
            deploy.phase = "create";
            break;
        default:
            throw new Error(`Deploy in unknown phase: ${deploy.phase}`);
    }
}

export function isTerminalPhase(state: TDeployPhase): boolean {
    return state === "complete" || state === "cancelled";
}

export type TDeploy = {
    upgradePath: string; // the name of the upgrade script used.
    phase: TDeployPhase;
    startTime?: string; // human readable timestamp of when this started, from zeus's perspective.
    endTime?: string; // human readable timestamp of when this completed, from zeus's perspective.
    
    update?: () => Promise<void> // updates the deploy object on the repo.
}

export async function getActiveDeploy(user: TState, env: string): Promise<TDeploy | undefined> {
    const repoDetails = {
        owner: user.zeusHostOwner!,
        repo: user.zeusHostRepo!,
    };
    const github = user.github!;
    const environmentPath = `environment/${env}/deploys`;

    try {
        // Fetch the contents of the 'environment/{name}/deploys' directory
        const { data: directoryContents } = await github.rest.repos.getContent({
            ...repoDetails,
            path: environmentPath,
        });

        if (!Array.isArray(directoryContents) || directoryContents.length === 0) {
            return undefined; // No deploys found
        }

        // Sort directories by name to find the latest deploy (assuming alphabetical ordering of timestamps)
        const sortedDirectories = directoryContents
            .filter(item => item.type === "dir")
            .sort((a, b) => b.name.localeCompare(a.name));

        const latestDeployDir = sortedDirectories[0];
        const deployJsonPath = `${environmentPath}/${latestDeployDir.name}/deploy.json`;

        // Fetch the deploy.json file content
        const { data: deployFile } = await github.rest.repos.getContent({
            ...repoDetails,
            path: deployJsonPath,
        });

        if (!("content" in deployFile) || !deployFile.content) {
            throw new Error(`deploy.json not found in ${deployJsonPath}`);
        }

        // Decode the base64 content of deploy.json
        const deployJsonContent = Buffer.from(deployFile.content, "base64").toString("utf-8");
        const deployData: TDeploy = JSON.parse(deployJsonContent);

        return deployData;
    } catch (error) {
        if (`${error}`.includes('Not Found')) {
            // If the environment or deploy directory is not found, return undefined
            return undefined;
        } else {
            throw error;
        }
    }
}