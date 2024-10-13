import {command} from 'cmd-ts';
import {json} from '../args';
import { inRepo, requires, TState } from '../inject';

async function handler(user: TState) {
    try {
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
    handler: requires(handler, inRepo),
})

export default cmd;