import { subcommands, } from "cmd-ts";
import status from './cmd/status.js';
import run from './cmd/run.js';
import verify from './cmd/verify.js';

export default subcommands({
    name: 'deploy',
    description: 'promotes an environment by replaying its upgrade script and triggering a sign of the transaction.',
    version: '1.0.0',
    cmds: {
        status, run, verify
    }
});