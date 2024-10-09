import {command} from 'cmd-ts';
import {json} from '../args.js';
import { requires, TState } from '../inject.js';

async function handler(user: TState) {
    try {
        if (await user.metadataStore!.isLoggedIn()) {
            console.info("warning: already logged in.");
        }

        await user.metadataStore!.login();
        console.log(`Happy deploying!`);
    } catch(e) {
        console.error(`failed logging in: ${e}`)
    }
}

const cmd = command({
    name: 'login',
    description: 'login to zeus',
    version: '1.0.0',
    args: {
        json,
    },
    handler: requires(handler),
})

export default cmd;