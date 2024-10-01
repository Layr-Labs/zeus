import {command } from 'cmd-ts';
import { loadExistingEnvs } from './list.js';
import { requiresLogin, TState } from '../../inject.js';
import { question } from '../../utils.js';

async function handler(user: TState, args: {}): Promise<void> {
    const gh = user.github!;
    const existingEnvs = await loadExistingEnvs(user);
    const zeusRepo = {
        owner: user.zeusHostOwner!,
        repo: user.zeusHostRepo!,
    }
    const { data: repoData } = await gh.rest.repos.get(zeusRepo);
    const defaultBranch = repoData.default_branch;

    const envName = question({
        text: "Environment name?",
        isValid: (text: string) => {
            const isValidRegex = /^[a-zA-Z0-9-]+$/.test(text)
            const isNotTaken = existingEnvs.filter(e => e.name === text).length == 0;
            return isValidRegex && isNotTaken; 
        },
        maxAttempts: 5,
        errorMessage: "failed to create environment"
    })

    // Step 1: Get the latest commit SHA of the base branch

    var latestCommitSha: any;
    try {
        const { data: baseBranchData } = await gh!.rest.repos.getBranch({
            ...zeusRepo,
            branch: defaultBranch, // default branch
        });

        latestCommitSha = baseBranchData.commit.sha;
    } catch (e) {
        // create initial commit if we fail to get the default branch.
        if (`${e}`.includes('Branch not found')) {
            throw new Error(`Your ZEUS_HOST is uninitialized. Please push a blank commit to it. Thanks!`)
            // console.info(`creating repo initial blob`);
            // const { data: blobData } = await gh.rest.git.createBlob({
            //     ...zeusRepo,
            //     content: 'Zeus!',
            //     encoding: 'utf-8',
            // });

            // // // Step 2: Create a tree that points to the new blob
            // console.info(`creating repo initial tree`);
            // const { data: treeData } = await gh.rest.git.createTree({
            //     ...zeusRepo,
            //     tree: [
            //         {
            //             path: 'README.md',
            //             mode: '100644',
            //             type: 'blob',
            //             sha: blobData.sha,
            //         },
            //     ],
            // });

            // console.info(`creating repo initial commit`);
            // const { data: commitData } = await gh.rest.git.createCommit({
            //     ...zeusRepo,
            //     message: 'Initial commit',
            //     tree: treeData.sha, // Initially, the tree can be empty
            //     parents: [], // No parents for the first commit
            // });

            // await gh.rest.git.createRef({
            //     ...zeusRepo,
            //     ref: `refs/heads/${defaultBranch}`,
            //     sha: commitData.sha,
            //   });
            // latestCommitSha = commitData.sha;
        } else {
            throw e;
        }
    }

    await gh.rest.git.createRef({
        ...zeusRepo,
        ref: `refs/heads/${envName}`, // Git references must use the format 'refs/heads/{branch}'
        sha: latestCommitSha,
    });
  
    console.log("Created environment!");
}

const cmd = command({
    name: 'new',
    description: 'create a new environment',
    version: '1.0.0',
    args: {},
    handler: requiresLogin(handler),
})

export default cmd;