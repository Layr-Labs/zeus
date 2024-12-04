import semver from 'semver';
import { isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

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
    TScriptPhase |
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

export type TSegmentType = "eoa" | "multisig" | "script";

export type TScriptPhase = "script_run";

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
    immediateExecutionHash?: `0x${string}`
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

export const ArgumentValidFn: Record<Argument['type'], (text: string) => boolean> = {
  'string': (text: string) => text.length > 0,
  'number': (text: string) => {
      try {
          parseFloat(text);
          return true;
      } catch {
          return false;
      }
  },
  'privateKey': (text: string) => {
    try {
      privateKeyToAccount(text as `0x${string}`);
      return true;
    } catch {
      return false;
    }
  },
  'address': (text: string) => {
      return isAddress(text)
  },
  'url': (text: string) => {
      try {
          new URL(text);
          return true;
      } catch {
          return false;
      }
  }
}

export interface Argument {
  type: "string" | "number" | "address" | "url" | "privateKey",
  inputType?: "text" | "password",
  prompt: string,
  name: string
  passBy: `env` | `arg`
}

export interface TPhase {
  // eoa: should be treated as an upgrade from a single wallet, broadcast literally as-is.
  // multisig: transactions are encoded as a multicall and sent to gnosis.
  // script: a script is executed (i.e via zeus run) as part of the phase.
  type: 'eoa' | 'multisig' | 'script'

  // path, relative to the manifest's location.
  filename: string; 

  // additional arguments, especially for the script phase.
  arguments?: Argument[]
}

export interface Segment extends TPhase {
  id: number;
}

export interface TUpgrade {
    name: string;
    from: string; // a semver range, "^0.0.1"
    to: string; // the target to upgrade to. "0.0.2".
    phases: TPhase[];
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

export interface TMutation {
  // old value of the mutated variable.
  prev: unknown | undefined;

  // new value of the mutated variable.
  next: unknown | undefined;

  // the recorded type.
  internalType: number;

  // the name of the environment value modified. corresponds to `ZEUS_ENV_name` while running.
  name: string;
}

export interface TDeployStateMutations {
  // purposefully marked ? in case the deploy had no mutations at all (and thus didn't create this file.)
  mutations?: TMutation[];
}

export interface TTestOutput {
  forge: unknown;
  code: number;
  stdout: string;
  stderr: string;
}
export interface BytecodeReference {start: number, length: number};

export interface TArtifactScriptRun {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  date: string;
}

export interface ForgeSolidityMetadata {
    abi: unknown[]; // ABI, can be more specific if you know the structure
    bytecode: {
      object: string;
      sourceMap: string;
      linkReferences?: Record<string, BytecodeReference[]>;
      immutableReferences?: Record<string, BytecodeReference[]>;
    };
    deployedBytecode: {
      object: `0x${string}`;
      sourceMap: string;
      linkReferences?: Record<string, BytecodeReference[]>;
      immutableReferences?: Record<string, BytecodeReference[]>;
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

function isArgument(obj: unknown): obj is Argument {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const arg = obj as Argument;

  const validTypes = ["string", "number", "address", "url", "privateKey"];
  const validInputTypes = ["text", "password"];
  const validPassBy = ["env", "arg"];

  return (
    typeof arg.type === "string" &&
    validTypes.includes(arg.type) &&
    (arg.inputType === undefined || validInputTypes.includes(arg.inputType)) &&
    typeof arg.prompt === "string" &&
    typeof arg.name === "string" &&
    validPassBy.includes(arg.passBy)
  );
}

// TODO: THIS SHOULD ALL BE AJV + SCHEMA.
export function isPhase(_obj: unknown, index: number): _obj is TPhase {
  if (typeof _obj !== 'object') {
    console.error(`invalid phases.${index} -- must be a JSON object.`);
    return false;
  }
  const obj = _obj as Record<string, unknown>;
  if (typeof obj.type !== 'string' || !['eoa', 'multisig', 'script'].includes(obj.type)) {
    console.log(`phases.${index}.type - invalid option.`);
    return false;
  }

  if (obj.arguments && !Array.isArray(obj.arguments)) {
    console.log(`phases.${index}.arguments -- expected array.`);
    return false;
  }

  if (((obj.arguments as unknown[]) ?? []).find(arg => !isArgument(arg))) {
    console.error(`phases.${index}.arguments -- one or more arguments were invalid.`);
    console.error(`expected: `)
    console.error(JSON.stringify({
      type: ["string", "number", "address", "url", "privateKey"],
      inputType: ["text", "password"],
      passBy: ["env", "arg"],
      name: "string",
      prompt: "string"
    }, null, 2))
    return false;
  }

  return true;
}

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
    if (!obj.phases || !Array.isArray(obj.phases) || obj.phases.length === 0) {
      console.error(`"phases" was empty or invalid.`);
      return false;
    }
    const anyInvalid = obj.phases.find((phase, i) => !isPhase(phase, i));
    if (anyInvalid) {
      console.error(`One or more phases were invalid. Please double check syntax.`);
      return false;
    } 

    if (!semver.validRange(obj.from)) {
        console.error('invalid `from` constraint.');
        return false;
    }

    if (obj.to && !semver.valid(obj.to)) {
        console.error('invalid `to` constraint. If specified, must be a valid semver target. If unspecified, the upgrade does not progress the version.');
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

export interface TDeployedContractWithValidations extends TDeployedContract {
  validations?: {
    by: string;
    valid: boolean;
    expectedBytecodeHash?: `0x${string}`;
  }[];
}

export interface TForgeContractMetadata {
  abi: unknown[];
  bytecode: {
    object: `0x${string}`;
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
        details?: string;
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
      compilationTarget: Record<string ,string>;
      evmVersion: string;
      libraries: Record<string, string>;
    };
    sources: Record<string, {
      keccak256: string;
      urls: string[];
      license: string;
    }>;
    
    version: number;
  };
  id: number;
}

export interface TDeployedInstance extends TDeployedContract {
    index: number;
}

export interface TDeployedContractsManifest {
    contracts: TDeployedContractWithValidations[]
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