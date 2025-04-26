---
sidebar_position: 1
title: Environments Overview
description: Understanding Zeus environments and their management
---

# Zeus Environments

Environments in Zeus provide isolated contexts for deploying and managing your contracts across different networks (like testnets, staging, and production).

## What Are Zeus Environments?

A Zeus environment maintains two key components:

1. **Scalar Parameters** - Configuration values that can affect deployment behavior
2. **Contract Addresses** - A registry of deployed contract addresses that evolves over time

### Scalar Parameters

These are configuration values that can be accessed in your deployment scripts. While they can be modified, it's generally best to treat them as read-only. If you find yourself frequently changing a parameter, consider tracking it on-chain instead.

Parameters can be accessed and (if necessary) modified using methods exposed in the base Zeus script:

```solidity
// Reading a parameter
uint256 myValue = zUint("MY_PARAMETER");

// Setting a parameter (use sparingly)
zUpdate("MY_PARAMETER", newValue);
```

### Contract Registry

The contract registry tracks addresses of all deployed contracts. When you deploy contracts using Zeus functions, they're automatically added to this registry:

```solidity
// Deploy and register a contract
deploySingleton("MyContract", type(MyContract).creationCode);

// Deploy a contract with constructor arguments
deployInstance("MyContractWithArgs", type(MyContract).creationCode, abi.encode(arg1, arg2));
```

## Creating Environments

To create a new environment:

```bash
zeus env new
```

Follow the interactive prompts to configure your environment.

## Viewing Environment Details

To see all contracts, parameters, and other details for an environment:

```bash
zeus env show <env-name>
```

## Environment Versioning

Zeus environments have versions that must be compatible with your upgrade scripts. When you register an upgrade, you specify:

- The versions your upgrade can be applied to (`from`)
- The version your upgrade will result in (`to`)

This versioning system ensures that upgrades are applied in the correct order and to compatible environments.

## Environment Consistency

An important feature of Zeus is that environments are only updated after a successful deployment. If a deployment fails, is cancelled, or aborts for any reason, the environment in Zeus will not reflect any changes from the partial deployment.

This ensures that your environment always represents a consistent state with fully applied upgrades.

## Environments with Multiple Signers

Zeus is designed to work with multiple signers across different organizations. This is particularly useful when dealing with permissioned systems that require multiple parties to sign off on changes.

Using Zeus, each party can verify the exact transactions they're approving, ensuring transparency and security in the deployment process.

## Next Steps

- [Learn about environment configuration](./configuration.md)
- [Discover best practices for managing environments](./best-practices.md)