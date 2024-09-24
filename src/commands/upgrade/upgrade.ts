import { subcommands } from "cmd-ts";
import newCmd from './cmd/new';

export default subcommands({
    name: 'upgrade',
    description: 'Upgrade',
    version: '1.0.0',
    cmds: {
        "new": newCmd
    }
});