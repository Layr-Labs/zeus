# Zeus

Zeus helps manage complex deploy processes for onchain software.

## Should I use Zeus?

You may find Zeus useful if:
- You use forge, `forge create` or `forge script` to deploy your projects.
- You use multiple multisigs to deploy your onchain software. (i.e for permissioned proxy/implementation upgrades)
- You have multiple deploy environments (i.e. testnet vs mainnet) and want to automatically track where your contracts are deployed.
    - Zeus upgrade scripts are *"write once, run anywhere"*. **No more writing a "holesky" script, and then a "mainnet" script.**


## Key Features
Zeus integrates with `forge`, and extends its capabilities.

Zeus supports;
- Expressing your transactions, meant for a multisig, as a forge script. 
- Managing the lifecycle of your deploys across multiple environments. (`zeus deploy status`)
- Tracking deployed contracts across multiple environments. (`zeus which MyContract`)
- Testing your upgrade scripts (`zeus test`)
- Running binaries which require contract addresses (without hardcoding addresses) (`zeus run`)

# Setting up Zeus in your project

## Prerequisites:
- Node 22 (`node --version` to check)
- `forge`

## Steps
1. Create a new Github repository, and install the [Zeus Deployer app](https://github.com/apps/zeus-deployer/installations/select_target). 
2. `npm install -g @layr-labs/zeus`
3. `zeus login`
4. `zeus init` -- when prompted for your metadata repo, provide the repo from step 0.
5. `zeus env new` -- create your first environment to deploy your contracts into.

# Using Zeus

Check out our examples here: [zeus-examples](https://google.com/TODO).

Here are some common things to do with Zeus:

### Writing an upgrade
See the "How to write upgrades" section.

### Running Zeus Tests
Every upgrade script you write will (hopefully) have tests in it. You can run those scripts as tests
by using `zeus test`.

- `zeus test --env <env> ./path/to/upgrade/script.s.sol` (NOTE: this accepts a glob / multiple arguments)

### Seeing an environment
- `zeus env show <env>` (view all contracts, environment parameters, etc. for a given environment)

### Running a deploy:
1. See if your upgrade is available to run in your environment:
    - `zeus upgrade list --env <env>`

2. If it's there, great. If it's not, your environment is either on the wrong version OR you didn't register your upgrade.

    To see if you registered your upgrade at all, check:
    - `zeus upgrade list`

    If your upgrade isn't in that list, you need to register it. Make sure you're on the correct commit you want 
    everyone to run your upgrade from, and then run;

    - `zeus upgrade register` and follow the on-screen instructions.

3. Start your deploy!

    - `zeus deploy run --upgrade <directory name> --env <env>`
    NOTE: `directory name` is what Zeus uses right now to identify upgrades.

4. Your deploy may halt periodically in between steps. You can resume your deploy with:

    - `zeus deploy run --resume --env <env>`

### Verifying a deploy

- While a deploy is ongoing, you can run:
    `zeus deploy verify --env <env>`

To verify that the contracts this deploy claims to have produced match what is available in the repository.

- Zeus uses an algorithm that compares your local bytecode, with immutableReferences zero'd out, against bytecode that is available onchain (with the same bytecode segments zero'd out).

> [!TIP]
> Make sure you double check your foundry version (forge --version) before doing this. Differences in forge versions have been known to affect hash calculations.

> [!NOTE] 
> If you are logged in and have write access to the ZEUS_HOST, you will automatically post a small commit indicating that you verified those contracts locally.

### Cancelling a deploy

- You may be able to cancel a deploy, depending on what state it is in. 

    `zeus deploy cancel --env <env>`

For multisig transactions, Zeus will attempt to propose an alternate null transaction to overwrite the nonce onchain.
EOA transactions are not cancellable if they have been executed.

# Zeus Concepts

- Zeus environments maintain two things:
    - A set of scalar parameters. You can modify these overtime, using the methods exposed in the [base Zeus script](https://github.com/Layr-Labs/zeus-templates/blob/master/test/ZeusScript.test.sol#L76).
    - A set of contract addresses. These evolve over time when you invoke `deploySingleton()` or `deployInstance()` ((see here)[https://github.com/Layr-Labs/zeus-templates/blob/master/test/ZeusScript.test.sol#L46]).

    Generally, scalar parameters should be read only. If you find yourself modifying scalar parameters, you should probably be
    tracking that value onchain!

- Zeus upgrades will apply any changes to the environment (contracts or parameters) ONLY if the entire deploy is successful (i.e all steps up to and including the final step of the upgrade succeed)
    - In the case of a failure, cancellation, or other abort, the environment in zeus will not reflect any updated parameters.

 # Contributing 

 See CONTRIBUTING.md.

# License

See LICENSE.



