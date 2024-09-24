import { subcommands } from "cmd-ts";
import newCmd from './cmd/new.js';

export default subcommands({
    name: 'upgrade',
    description: 'Manage and create different protocol upgrades',
    version: '1.0.0',
    cmds: {
        "new": newCmd
    }
});