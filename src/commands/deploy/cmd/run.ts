import { command, positional, string } from "cmd-ts";
import { json } from "../../common.js";

const cmd = command({
    name: 'run',
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
