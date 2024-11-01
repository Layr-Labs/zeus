import { spawn } from "child_process";

export interface Result {
    stdout: string;
    stderr: string;
    code: number;       
}

export interface TForgeOutput {
    output: {
        success: boolean,
        returns: {
            '0': {
                value: string;
            }
        }
    }
}

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