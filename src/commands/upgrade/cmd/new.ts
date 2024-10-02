import {command, positional, string} from 'cmd-ts';
import {json} from '../../common.js';
import { requiresLogin, TState } from '../../inject.js';

const handler = async function(user: TState, args: {env: string | undefined, json: boolean}) {
    // TODO: implement creating a new upgrade.
};

const cmd = command({
    name: 'new',
    description: 'register a new upgrade',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        json,
    },
    handler: requiresLogin(handler),
})
export default cmd;