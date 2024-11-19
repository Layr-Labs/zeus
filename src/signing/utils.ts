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


export interface TForgeOutput {
    stateUpdates: {
        name: string,
        value: unknown,
        internalType: number,   
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
    BOOL = 6
};
  
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
            const stateUpdates = parsedLogs.map(update => {
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
                    }
                })()[0];

                return {
                    name: update.args.key,
                    internalType: update.args.internalType,
                    value: parsedValue
                }
            })
            return {output: parsedJson, stateUpdates};
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