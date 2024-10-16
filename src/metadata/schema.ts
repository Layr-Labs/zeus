export type TDeployManifest = {
    inProgressDeploy?: string;
}

// Current status, if applicable, of an ongoing deploy in this environment.
// - "" - the upgrade has not started yet.
// - "complete" - the upgrade has been fully applied, and all metadata is available.
// - "cancelled" - the upgrade was cancelled during the timelock phase, if applicable.
export type TDeployPhase = (
    "" |
    TEOAPhase |
    TMultisigPhase |
     "complete" | 
     "cancelled" | 
     "failed" 
)

// - "eoa_start" -- [eoa] the `create` phase has been run and is submitted to the network.
//    * CLI should confirm that etherscan has ABIs for contracts.
// - "eoa_wait_confirm" -- we are waiting for the confirmation of the associated transactions from deploy.
export enum EOAPhase {
    START = "eoa_start",
    WAIT = "eoa_wait_confirm"
}
export type TEOAPhase = `${EOAPhase}`;

// - "multisig_start" - We're awaiting the execution of a script that uses MultisigBuilder, submitting the results to gnosis safe.
// - "multisig_submit" - We're awaiting the submission of a transaction to the gnosis safe API.
// - "multisig_wait_signers" - We're awaiting signers on the gnosis safe transaction.
// - "multisig_execute" - We're waiting for the safe transaction to be executed.
// - "multisig_wait_confirm" - We're waiting for the safe transaction to be confirmed.
export enum MultisigPhase {
    START = "multisig_start",
    WAIT = "multisig_wait_signers",
    EXECUTE = "multisig_execute",
    CONFIRM = "multisig_wait_confirm"
}
export type TMultisigPhase = `${MultisigPhase}`;

export type Deployment = {
    contract: string; // the contract name
    address: `0x${string}`; // the contract onchain address.
    name?: string; // if singleton'd in the repo, this is the singleton's name.
}

export type TSegmentType = "eoa" | "multisig";

export type EOAMetadata = {
    type: "eoa",
    signer: `0x${string}`,
    transactions: `0x${string}`[],
    deployments: Deployment[],
    confirmed: boolean, // whether the transactions were confirmed onchain with receipts.
}

export type MultisigMetadata = {
    type: "multisig",
    signer: `0x${string}`, // the signatory to the multisig transaction.
    signerType: "eoa" | "ledger",
    gnosisTransactionHash: `0x${string}`, // for later referencing the transaction.
    gnosisCalldata?: `0x${string}`, // for later executing the transaction
    multisig: `0x${string}`
    confirmed: boolean,
    cancellationTransactionHash: `0x${string}` | undefined;
}

export type Segment = {
    id: number;
    filename: string;
    type: TSegmentType;
}

export type TDeploy = {
    name: string;
    env: string;
    upgrade: string;

    chainId: number;
    upgradePath: string; // the name of the upgrade directory used.

    phase: TDeployPhase; // the current unfinished state of the deploy. this phase is local to the `segment`, unless "" | "cancelled" | "completed".
    segmentId: number; // deploys are made of multiple segments, which can be either EOA or Multisig scripts.
    segments: Segment[]; // an ordered list of all available segments

    metadata: (EOAMetadata | MultisigMetadata)[] // for the segments identified at the top, this is the ongoing state-tracking for their process.

    startTime: string; // human readable timestamp of when this started, from zeus's perspective.
    startTimestamp: number; // unix ts
    
    endTime?: string; // human readable timestamp of when this completed, from zeus's perspective.
    endTimestamp?: number; // unix ts
}

export type TUpgrade = {
    name: string;
    fromSemver: string;
    to: string;
    phases: string[];
}

export type TUpgradeManifest = {
    upgrades: TUpgrade[];
}

export interface TEnvironmentManifest {
    id: string;                                 // "testnet"

    chainId: number;

    /**
     * The envirnoment that this environment promotes to.
     */
    precedes: string;                           // "mainnet"

    /**
     * important contract addresses for thie environment
     */
    contractAddresses: Record<string, string>;      

    /**
     * {@link SigningStrategy.id} that this environment requires.
     */
    signingStrategy: string;       
    
    /**
     * Latest commit of your repo deployed in this environment.
     */
    latestDeployedCommit: string;
}