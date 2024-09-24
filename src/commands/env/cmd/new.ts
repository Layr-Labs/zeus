import {command, positional, string} from 'cmd-ts';
import { json } from '../../common.js';

const cmd = command({
    name: 'new',
    description: 'create a new environment',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        json,
    },
    handler: async function() {
        // TODO: implement
    },
})

export default cmd;