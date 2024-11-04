import semver from 'semver';

export interface TDeployManifest {
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

// - "eoa_validate" -- We are running tests, performing a dry run, and validating that the
// - "eoa_start" -- [eoa] the `create` phase has been run and is submitted to the network.
//    * CLI should confirm that etherscan has ABIs for contracts.
// - "eoa_wait_confirm" -- we are waiting for the confirmation of the associated transactions from deploy.
export enum EOAPhase {
    VALIDATE = "eoa_validate",
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

export type TSegmentType = "eoa" | "multisig";

export interface EOAMetadata {
    type: "eoa",
    signer: `0x${string}`,
    transactions: `0x${string}`[],
    deployments: TDeployedContractSparse[],
    confirmed: boolean, // whether the transactions were confirmed onchain with receipts.
}

export interface MultisigMetadata {
    type: "multisig",
    signer: `0x${string}`, // the signatory to the multisig transaction.
    signerType: "eoa" | "ledger",
    gnosisTransactionHash: `0x${string}`, // for later referencing the transaction.
    gnosisCalldata?: `0x${string}`, // for later executing the transaction
    multisig: `0x${string}`
    confirmed: boolean,
    cancellationTransactionHash: `0x${string}` | undefined;
}

export interface Segment {
    id: number;
    filename: string;
    type: TSegmentType;
}

export interface TDeploy {
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

export interface TUpgrade {
    name: string;
    from: string; // a semver range, "^0.0.1"
    to: string; // the target to upgrade to. "0.0.2".
    phases?: string[];
    commit: string;
}

export interface TDeployLock {
    // name of the holder.
    holder?: string;

    // auto-release the lock after this amount of time. Most locks are for 5 minutes.
    untilTimestampMs?: number;

    // what the lock-holder was doing.
    description?: string;
}

export interface TTestOutput {
  forge: unknown;
  code: number;
  stdout: string;
  stderr: string;
}

export interface ForgeSolidityMetadata {
    abi: unknown[]; // ABI, can be more specific if you know the structure
    bytecode: {
      object: string;
      sourceMap: string;
      linkReferences: Record<string, unknown>;
    };
    deployedBytecode: {
      object: `0x${string}`;
      sourceMap: string;
      linkReferences: Record<string, unknown>;
    };
    methodIdentifiers: Record<string, string>;
    rawMetadata: string;
    metadata: {
      compiler: {
        version: string;
      };
      language: string;
      output: {
        abi: unknown[];
        devdoc: {
          kind: string;
          methods: Record<string, unknown>;
          version: number;
        };
        userdoc: {
          kind: string;
          methods: Record<string, unknown>;
          version: number;
        };
      };
      settings: {
        remappings: string[];
        optimizer: {
          enabled: boolean;
          runs: number;
        };
        metadata: {
          bytecodeHash: string;
        };
        compilationTarget: Record<string, string>;
        evmVersion: string;
        libraries: Record<string, string>;
      };
      sources: Record<
        string,
        {
          keccak256: string;
          urls: string[];
          license: string;
        }
      >;
    };
    id: number;
  };

export function isUpgrade(_obj: unknown): _obj is TUpgrade {
    if (typeof _obj !== 'object') {
        console.error(`invalid upgrade.json -- must be a JSON object.`);
        return false;
    }
    const obj = _obj as Record<string, string>;
    if (!obj.name || obj.name.length > 20 || !/^[a-zA-Z0-9.-]+$/.test(obj.name)){ 
        console.error('invalid upgrade name.');
        return false;
    }
    if (!semver.validRange(obj.from)) {
        console.error('invalid `from` constraint.');
        return false;
    }
    if (!semver.valid(obj.to)) {
        console.error('invalid `to` constraint.');
        return false;
    }

    return true;
}

export interface TUpgradeManifest {
    upgrades: TUpgrade[];
}


export interface TDeployedContractSparse {
    singleton: boolean;
    contract: string;
    address: `0x${string}`;
}

export interface TDeployedContract extends TDeployedContractSparse {
    deployedBytecodeHash: `0x${string}`;
    // the last deployed upgrade that touched this contract.
    lastUpdatedIn: {
        name: string,
        phase: string;
        segment: number
    };
}

export interface TDeployedInstance extends TDeployedContract {
    index: number;
}

export interface TDeployedContractsManifest {
    contracts: TDeployedContract[]
}

export interface TEnvironmentManifest {
    id: string;                                 // "testnet"

    chainId: number;

    deployedVersion: string;                    // '1.0.0'

    // latest deployed contracts.
    contracts: {
        static: Record<string, TDeployedContract>,
        instances: TDeployedContract[],
    }

    /**
     * Latest commit of your repo deployed in this environment.
     */
    latestDeployedCommit: string;
}