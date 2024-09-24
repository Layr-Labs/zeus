import {command, positional, string} from 'cmd-ts';
import {json} from '../../common';

const cmd = command({
    name: 'new',
    description: 'create a new environment',
    version: '1.0.0',
    args: {
        env: positional({ type: string, displayName: 'env' }),
        json,
    },
    handler: async function() {
        // TODO: implement creating a new upgrade.
    },
})
export default cmd;