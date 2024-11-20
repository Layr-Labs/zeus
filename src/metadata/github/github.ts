import chalk from 'chalk';
import { URLSearchParams } from 'url';
import clipboard from 'clipboardy';
import open from 'open';

// const CLIENT_ID = 'Iv23ligjjeZxuYnTzp66'; // zeus app id.

const CLIENT_ID = 'Iv23liqCKmk8aAoijxqf';

const sleep = (timeMs: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, timeMs)
    })
};

export async function login(): Promise<string> {
    const params = new URLSearchParams({
        client_id: CLIENT_ID, 
        scope: 'repo read:user',
    })
    const state = { 
        didTimeout: false
    }
    const code = await fetch(`https://github.com/login/device/code?${params.toString()}`, {method: 'POST', headers: new Headers({'Accept': 'application/json'})});
    const resp = await code.json();
    
    console.log(`1. Navigate to:\n\t${chalk.blue(resp.verification_uri)}\n\n`)
    console.log(`2. Paste the following code:      ${chalk.bold(resp.user_code)}      (${chalk.italic(`expires in ${Math.floor(resp.expires_in/60)} minutes, auto-copied to clipboard!`)})`)

    clipboard.writeSync(resp.user_code);
    open(resp.verification_uri);

    const t = setTimeout(() => {
        state.didTimeout = true;
    }, resp.expires_in * 1000);
    
    const preventTimeout = () => {
        clearTimeout(t)
    }

    try {
        // begin polling for acceptance.
        const pollIntervalSeconds = resp.interval;
        while (true) {
            if (state.didTimeout) {
                throw new Error('operation timed out.');
            }
            try {
                const data = new URLSearchParams();
                data.append('client_id', CLIENT_ID);
                data.append('device_code', resp.device_code);
                data.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code')
                const req = await fetch(`https://github.com/login/oauth/access_token?${data.toString()}`, {method: 'POST', body: data, headers: new Headers({'Accept': 'application/json'})});
                const response = await req.json();
                if (response.access_token) {
                    return response.access_token as string;
                }
            } catch (e) {
                // continue...
                console.error(e);
            }

            if (state.didTimeout) {
                throw new Error('operation timed out.');
            }
            await sleep(pollIntervalSeconds * 1000);
        }
    } finally {
        preventTimeout();
    }
}