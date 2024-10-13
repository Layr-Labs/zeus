import { subcommands } from "cmd-ts";
import newCmd from './cmd/new';
import list from './cmd/list';

export default subcommands({
    name: 'env',
    description: 'list important information about an environment',
    version: '1.0.0',
    cmds: {
        "new": newCmd,
        "list": list
    }
});