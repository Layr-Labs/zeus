import {command} from 'cmd-ts';
import {json} from '../args.js';
import { GitMetadataStore } from '../../metadata/gitBackedMetadataStore.js';
import { load } from '../inject.js';
import { Octokit } from 'octokit';

const cmd = command({
    name: 'login',
    description: 'login to zeus',
    version: '1.0.0',
    args: {
        json,
    },
    handler: async function() {
        try {
            const metadata = new GitMetadataStore();
            await metadata.triggerLogin();

            // Extract the user's name (or login if the name is not set)
            console.log(`Happy deploying!`);
        } catch(e) {
            console.error(`failed logging in: ${e}`)
        }
    },
})

export default cmd;