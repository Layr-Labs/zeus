import { spawn } from "child_process";

export interface Result {
    stdout: string;
    stderr: string;
    code: number;       
}

export function runWithArgs(cmd: string, args: string[], env: Record<string, string>): Promise<Result> {
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
                console.log(data.toString());
            });

            child.stderr.on('data', (data) => {
                stderrData += data.toString();
                console.log(data.toString());
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