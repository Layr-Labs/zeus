import { subcommands } from "cmd-ts";
import newCmd from './cmd/new';
import listCmd from './cmd/list';

export default subcommands({
    name: 'upgrade',
    description: 'Manage and create different protocol upgrades',
    version: '1.0.0',
    cmds: {
        "new": newCmd,
        "list": listCmd
    }
});