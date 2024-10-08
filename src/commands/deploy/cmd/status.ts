import { command, positional, string } from "cmd-ts";
import {json} from '../../args.js';

const cmd = command({
    name: 'status',
    description: '',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        json,
    },
    handler: async function({env, json}: any) {
        // TODO: implement
    },
})

export default cmd;
