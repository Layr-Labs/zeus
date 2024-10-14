import { command, positional, string } from "cmd-ts";
import {json} from '../../args';

async function handler() {
    // TODO: implement
}

const cmd = command({
    name: 'verify',
    description: '',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        json,
    },
    handler: handler,
})

export default cmd;
