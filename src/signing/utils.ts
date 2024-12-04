import { spawn } from "child_process";
import { decodeAbiParameters, decodeEventLog } from "viem";
import {abi as zeusScriptAbi} from '../zeusScriptAbi';

export interface Result {
    stdout: string;
    stderr: string;
    code: number;       
}

export interface TForgeRun {
    timestamp: number,
    chain: number, 
    transactions: {
        hash: `0x${string}`,
        type: string,
        contractName: string,
        contractAddress: string
        transaction: {from: string},
    }[]
    logs: LogItem[];
    raw_logs: LogItem[];
    traces: TraceBlock[];
    gas_used: number;
    labeled_addresses: Record<string, string>;
    returned: string | null;
    address: string | null;
}

export function getTrace(data: TForgeRun, address: `0x${string}`): TraceItem | null {
    for (const traceBlock of data.traces) {
      for (const traceItem of traceBlock[1].arena) {
        const trace = traceItem.trace;
        if (trace.kind !== "CREATE") continue;
  
        // Check if the trace is of kind "CREATE" and matches the given address
        if (trace.address.toLowerCase() === address.toLowerCase() && trace.success) {
          // Return the label (contract name) if it exists in the decoded section
          return traceItem;
        }
      }
    }
  
    return null;
}

interface DeploymentLog {
    address: string;
    topics: string[];
    data: string;
}

interface DecodedLog {
name: string | null;
params: unknown[] | null; // Replace `any` with specific parameter structure if known
}

interface RawLog {
topics: string[];
data: string;
}

interface Trace {
depth: number;
success: boolean;
caller: string;
address: string;
maybe_precompile: boolean | null;
selfdestruct_address: string | null;
selfdestruct_refund_target: string | null;
selfdestruct_transferred_value: string | null;
kind: "CREATE" | "CALL" | "STATICCALL";
value: string;
data: string;
output: string | null;
gas_used: number;
gas_limit: number;
status: "Return" | "Stop";
steps: unknown[];
decoded: {
    label: string | null;
    return_data: string | null;
    call_data: string | null;
};
}

interface ArenaTrace {
parent: number | null;
children: number[];
idx: number;
trace: Trace;
logs: {
    raw_log: RawLog;
    decoded: DecodedLog;
    position: number;
}[];
ordering: unknown[];
}

interface Arena {
parent: number | null;
children: number[];
idx: number;
trace: Trace;
logs: DeploymentLog[];
ordering: unknown[];
}

interface Execution {
arena: ArenaTrace[];
}

interface Deployment {
arena: Arena[];
}

interface UnitKind {
Unit: {
    gas: number;
};
}

interface TestResult {
status: "Success" | "Failure"; // Add other statuses if applicable
reason: string | null;
counterexample: unknown | null; // Replace `any` with specific structure if known
logs: DeploymentLog[];
decoded_logs: string[];
kind: UnitKind | null;
traces: [string, Deployment | Execution][];
labeled_addresses: Record<string, unknown>; // Replace `any` with specific structure if known
duration: {
    secs: number;
    nanos: number;
};
breakpoints: Record<string, unknown>; // Replace `any` with specific structure if known
gas_snapshots: Record<string, unknown>; // Replace `any` with specific structure if known
}

type TestResults = Record<string, TestResult>

interface ScriptResult {
duration: string;
test_results: TestResults;
warnings: string[];
}
  
export type TForgeTestOutput = Record<string, ScriptResult>

export interface TForgeOutput {
    safeContext?: {
        addr: `0x${string}`;
        callType: number;
    },
    stateUpdates: {
        name: string,
        value: unknown,
        internalType: number,   
    }[],
    contractDeploys: {
        name: string;
        addr: `0x${string}`;
        singleton: boolean;
    }[],
    output: {
        timestamp: number,
        chain: number, 
        success: boolean,
        returns: {
            '0': {
                value: string;
            }
        }
        transactions: {
            hash: `0x${string}`,
            contractName: string,
            contractAddress: string
            transaction: {from: string},
            type: string
        }[],
        logs: LogItem[];
        raw_logs: LogItem[];
        traces: TraceBlock[];
        gas_used: number;
        labeled_addresses: Record<string, string>;
        returned: string | null;
        address: string | null;
    }
}

export interface TraceItem {
    parent: number | null;
    children: number[];
    idx: number;
    trace: {
        depth: number;
        success: boolean;
        caller: string;
        address: string;
        maybe_precompile: boolean | null;
        selfdestruct_address: string | null;
        selfdestruct_refund_target: string | null;
        selfdestruct_transferred_value: string | null;
        kind: "CREATE" | "CALL" | "STATICCALL";
        value: string;
        data: string;
        gas_used: number;
        gas_limit: number;
        status: string;
        output?: string;
        steps: unknown[];
        decoded: {
            label: string | null;
            return_data: string | null;
            call_data: string | null;
        };
    };
    logs: {
        raw_log: {
        topics: string[];
        data: string;
        };
        decoded: {
        name: string | null;
        params: unknown | null;
        };
        position: number;
    }[];
    ordering: Record<string, number>[];
};

type TraceBlock = ["Deployment" | "Execution", { arena: TraceItem[] }];

interface LogItem {
    address: `0x${string}`;
    topics: [`0x${string}`, ...`0x${string}`[]];
    data: `0x${string}`;
};

enum InternalModifiedType {
    UNMODIFIED = 0,
    UINT_256 = 1,
    UINT_32 = 2,
    UINT_64 = 3,
    ADDRESS = 4,
    STRING = 5,
    BOOL = 6,
    UINT_16 = 7,
    UINT_8 = 8
};
  
export function parseForgeTestOutput(stdout: string): TForgeTestOutput {
    return JSON.parse(stdout.trim()) as TForgeTestOutput;
}   

export function parseForgeOutput(stdout: string): TForgeOutput {
    const lines = stdout.split('\n');
    const jsonLine = lines.find(line => line.trim().startsWith('{'));
    if (jsonLine) {
        try {
            const parsedJson = JSON.parse(jsonLine) as TForgeOutput['output'];
            // check for state update logs...
            const parsedLogs = parsedJson.raw_logs.map((log) => {
                try {
                    return decodeEventLog({abi: zeusScriptAbi, data: log.data, topics: log.topics})
                } catch {
                    return undefined;
                }
            }).filter(v => !!v);

            const contractDeploys = parsedLogs.filter(update => update.eventName === 'ZeusDeploy').map(update => {
                return update.args;
            })

            const safeContext = parsedLogs.find(update => update.eventName === `ZeusRequireMultisig`)?.args;

            const stateUpdates = parsedLogs.filter(update => update.eventName === 'ZeusEnvironmentUpdate').map(update => {
                const parsedValue = (() => {
                    switch (update.args.internalType as InternalModifiedType) {
                        case InternalModifiedType.UNMODIFIED:
                            throw new Error(`Got invalid modified type from zUpdate()...`);
                        case InternalModifiedType.UINT_256:
                            return decodeAbiParameters([{type: 'uint256'}], update.args.value).toString()
                        case InternalModifiedType.UINT_32:
                            return decodeAbiParameters([{type: 'uint32'}], update.args.value)
                        case InternalModifiedType.UINT_64:
                            return decodeAbiParameters([{type: 'uint64'}], update.args.value)
                        case InternalModifiedType.ADDRESS:
                            return decodeAbiParameters([{type: 'address'}], update.args.value)
                        case InternalModifiedType.STRING:
                            return decodeAbiParameters([{type: 'string'}], update.args.value)
                        case InternalModifiedType.BOOL:
                            return decodeAbiParameters([{type: 'bool'}], update.args.value)
                        case InternalModifiedType.UINT_16:
                            return decodeAbiParameters([{type: 'uint16'}], update.args.value)
                        case InternalModifiedType.UINT_8:
                            return decodeAbiParameters([{type: 'uint8'}], update.args.value)
                    }
                })()[0];

                return {
                    name: update.args.key,
                    internalType: update.args.internalType,
                    value: parsedValue
                }
            })
            return {output: parsedJson, stateUpdates, contractDeploys, safeContext};
        } catch (e) {
            throw new Error(`Failed to parse JSON: ${e}`);
        }
    } else {
        throw new Error('No JSON output found.');
    }
}

export function runWithArgs(cmd: string, args: string[], env: Record<string, string | undefined>, liveOutput = false): Promise<Result> {
    return new Promise((resolve, reject) => {
        try {
            const child = spawn(cmd, args, {stdio: 'pipe', env: {
                ...process.env,
                ...env,
            }});

            let stdoutData = '';
            let stderrData = '';

            child.stdout.on('data', (data) => {
                stdoutData += data.toString();
                if (liveOutput) {
                    console.log(data.toString());
                }
            });

            child.stderr.on('data', (data) => {
                stderrData += data.toString();
                if (liveOutput) {
                    console.error(data.toString());
                }
            });

            child.on('close', (code) => {
                if (code != 0) {
                    reject({stdout: stdoutData, code, stderr: stderrData})
                } else {
                    resolve({stdout: stdoutData, code, stderr: stderrData})
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}