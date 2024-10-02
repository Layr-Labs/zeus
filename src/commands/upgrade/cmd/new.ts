import {command, positional, string} from 'cmd-ts';
import {json} from '../../common.js';
import { requiresLogin, TState } from '../../inject.js';
import { select } from '@inquirer/prompts';

const handler = async function(user: TState, args: {json: boolean}) {
    // TODO: implement creating a new upgrade.

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
    
      // TODO: implement
      throw new Error(`${answer} unsupported.`);
};

const cmd = command({
    name: 'new',
    description: 'register a new upgrade',
    version: '1.0.0',
    args: {
        json,
    },
    handler: requiresLogin(handler),
})
export default cmd;