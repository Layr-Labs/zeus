# Zeus Project Overview

## Project Purpose
Zeus is a web3 deployer and metadata manager developed by Layr Labs (Eigen Labs, Inc.). It manages complex deployment processes for onchain software, particularly designed for teams using Forge and multiple multisig wallets.

## Key Features
- **Smart Contract Deployment Management**: Integrates with Forge to manage complex deployment processes
- **Multi-environment Support**: Write once, deploy anywhere (testnet vs mainnet)
- **Multisig Integration**: Supports multiple multisig wallets for permissioned deployments
- **Contract Tracking**: Automatically tracks deployed contracts across environments
- **Upgrade Management**: Manages upgrade lifecycles with version constraints
- **Testing Integration**: Built-in testing for upgrade scripts
- **Paper Trail**: Generates comprehensive logs and artifacts for all deployments

## Target Users
Teams that:
- Use Forge for smart contract deployment
- Have multiple deployment environments
- Use multisig wallets for upgrades
- Need automated contract address tracking
- Want "write once, run anywhere" deployment scripts

## Architecture
- **CLI Tool**: Built as a global npm package (`@layr-labs/zeus`)
- **Command Structure**: Hierarchical subcommands (deploy, env, upgrade, login, etc.)
- **Metadata Management**: GitHub-based metadata storage for deployment tracking
- **Signing Strategies**: Multiple signing methods (EOA, Ledger, Gnosis Safe)
- **Environment Management**: Scalar parameters and contract addresses per environment