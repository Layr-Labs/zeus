import { subcommands, } from "cmd-ts";
import status from './cmd/status';
import run from './cmd/run';
import verify from './cmd/verify';

export default subcommands({
    name: 'deploy',
    description: 'promotes an environment by replaying its upgrade script and triggering a sign of the transaction.',
    version: '1.0.0',
    cmds: {
        status, run, verify
    }
});