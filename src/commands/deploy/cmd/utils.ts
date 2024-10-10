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
    const before = deploy.phase;
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
    console.log(`Updated phase: ${before} -> ${deploy.phase}`);
}

export const advance = (deploy: TDeploy) => {
    const before = deploy.phase;
    switch (deploy.phase) {
        case "":
            deploy.phase = "create";
            break;
        case "create":
            deploy.phase = "wait_create_confirm";
            break;
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
    console.log(`Updated phase: ${before} -> ${deploy.phase}`);
}

export function isTerminalPhase(state: TDeployPhase): boolean {
    return state === "complete" || state === "cancelled";
}

export type TDeploy = {
    env: string;
    upgrade: string;

    upgradePath: string; // the name of the upgrade script used.
    phase: TDeployPhase;
    startTime?: string; // human readable timestamp of when this started, from zeus's perspective.
    endTime?: string; // human readable timestamp of when this completed, from zeus's perspective.
    
    update?: () => Promise<void> // updates the deploy object on the repo.
}

export async function getActiveDeploy(user: TState, env: string): Promise<TDeploy | undefined> {
    const environmentPath = `environment/${env}/deploys`;
    try {
        // Fetch the contents of the 'environment/{name}/deploys' directory
        const directoryContents = await user.metadataStore!.getDirectory(environmentPath);

        if (!Array.isArray(directoryContents) || directoryContents.length === 0) {
            return undefined; // No deploys found
        }

        // Sort directories by name to find the latest deploy (assuming alphabetical ordering of timestamps)
        const sortedDirectories = directoryContents
            .filter(item => item.type === "dir")
            .sort((a, b) => b.name.localeCompare(a.name));

        const latestDeployDir = sortedDirectories[0];
        if (!latestDeployDir) {
            return;
        }

        // TODO: replace with canonicalPaths
        const deployJsonPath = `${environmentPath}/${latestDeployDir.name}/deploy.json`;

        // Fetch the deploy.json file content
        console.log(`Fetching file: ${deployJsonPath}`);
        const deploy = await user.metadataStore!.getJSONFile<TDeploy>(
            deployJsonPath
        ); 

        if (!deploy) {
            throw new Error(`deploy.json not found in ${deployJsonPath}`);
        }

        return deploy;
    } catch (error) {
        if (`${error}`.includes('Not Found')) {
            // If the environment or deploy directory is not found, return undefined
            return undefined;
        } else {
            throw error;
        }
    }
}