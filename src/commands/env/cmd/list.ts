import {command, positional, string} from 'cmd-ts';
import { json } from '../../common';

const cmd = command({
    name: 'list',
    description: 'list available environments',
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