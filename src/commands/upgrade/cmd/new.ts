import {command} from 'cmd-ts';
import {json} from '../../args';
import { loggedIn, requires } from '../../inject';
import { select } from '@inquirer/prompts';

const handler = async function() {
    const answer = await select({
        message: 'Select an upgrade strategy',
        choices: [
          {
            name: 'Solidity (Forge Script)',
            value: 'forge',
            description: 'write a structured forge script, expressing your upgrade with vm.startBroadcast().',
          },
          {
            name: 'TypeScript (Viem Script)',
            value: 'viem',
            description: 'extend a Typescript class, expressing your upgrade with viem contract calls.',
          },
        ],
      });

      switch (answer) {
        case 'viem':
            // TODO: codegen a new Upgrade for this.
            break;
        case 'forge':
            // TODO: codegen a new forge script for this.
            break;
        default:
            throw new Error(`${answer} unsupported.`);
      }
};

const cmd = command({
    name: 'new',
    description: 'register a new upgrade',
    version: '1.0.0',
    args: {
        json,
    },
    handler: requires(handler, loggedIn),
})
export default cmd;