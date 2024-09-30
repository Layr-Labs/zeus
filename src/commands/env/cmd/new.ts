import {command, positional, string} from 'cmd-ts';
import { json } from '../../common.js';

import { load, requiresLogin, TState } from '../../inject.js';

async function handler(user: TState, args: {json: boolean |undefined}): Promise<void> {
    // TODO: use `user.github` to create the environment.
}

const cmd = command({
    name: 'new',
    description: 'create a new environment',
    version: '1.0.0',
    args: {
        json,
    },
    handler: requiresLogin(handler),
})

export default cmd;