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
1. `npm install -g @layr-labs/zeus`
2. `zeus init`


