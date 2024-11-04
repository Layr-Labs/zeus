import { spawn } from "child_process";

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

export interface TForgeOutput {
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
    address: string;
    topics: string[];
    data: string;
};
  



export function parseForgeOutput(stdout: string): TForgeOutput {
    const lines = stdout.split('\n');
    const jsonLine = lines.find(line => line.trim().startsWith('{'));
    if (jsonLine) {
        try {
            const parsedJson = JSON.parse(jsonLine);
            return {output: parsedJson};
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