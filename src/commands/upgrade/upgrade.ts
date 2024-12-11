import { subcommands } from "cmd-ts";
import registerCmd from './cmd/register';
import listCmd from './cmd/list';
import envCmd from './cmd/env';

export default subcommands({
    name: 'upgrade',
    description: 'Manage and create different protocol upgrades',
    version: '1.0.0',
    cmds: {
        "register": registerCmd,
        "list": listCmd,
        "env": envCmd,
    }
});