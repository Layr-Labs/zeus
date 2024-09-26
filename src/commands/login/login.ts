import {command} from 'cmd-ts';
import { json } from '../common.js';
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
            const state = load()
            if (state?.dotZeus?.accessToken) {
                // check if token is live
                const client = new Octokit({auth: state?.dotZeus?.accessToken})
                let loggedIn = false;
                try {
                    await client.rest.repos.listContributors();
                    loggedIn = true;
                } catch {}

                if (loggedIn) {
                    console.log(`Already logged in!`);
                    return;
                } 
            } else {
                console.log(`no access token present`);
            }

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