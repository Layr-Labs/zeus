---
sidebar_position: 1
title: Writing Your First Migration
description: Learn how to create and register upgrades
---

# Writing Your First Migration

Zeus uses the concept of "upgrades" or "migrations" to manage changes to your smart contracts and their deployment across different environments.

## Setting Up Your Upgrade

1. **Install the Zeus Templates**

   ```bash
   forge install Layr-Labs/zeus-templates
   ```

2. **Create a New Upgrade Directory**

   Create a new directory for your upgrade in the upgrades directory specified in your `.zeus` configuration.

3. **Structure Your Upgrade**

   Your upgrade directory should contain:
   
   - One or more upgrade scripts (`.s.sol` files)
   - An upgrade manifest (`upgrade.json`)

## Creating an Upgrade Manifest

The upgrade manifest (`upgrade.json`) defines the structure and requirements of your upgrade:

```json
{
    "name": "my-upgrade-name",
    "from": ">=0.0.0 <=0.5.1",
    "to": "0.5.2",
    "phases": [
        {
            "type": "eoa",
            "filename": "1-eoa.s.sol"
        },
        {
            "type": "multisig",
            "filename": "2-multisig.s.sol"
        }
    ]
}
```

Key fields:
- `name`: The name of your upgrade
- `from`: A semver version constraint specifying which versions can apply this upgrade
- `to`: The target version after applying this upgrade
- `phases`: An array of deployment phases, each with a type and filename

## Writing Upgrade Scripts

Each phase in your upgrade.json corresponds to a Solidity script file. Here are common types:

### EOA Deployment Script

For transactions that can be performed by any EOA (Externally Owned Account):

```solidity
// 1-eoa.s.sol
pragma solidity ^0.8.0;

import "@zeus-templates/templates/EOADeployer.sol";

contract MyEOAScript is EOADeployer {
    function runAsEOA() internal override {
        // Your deployment logic here
        // Example: deploySingleton("MyContract", type(MyContract).creationCode);
    }
    
    // Test functions - prefixed with 'test'
    function testDeployment() public {
        // Test code here
    }
}
```

### Multisig Script

For transactions that require a multisig wallet:

```solidity
// 2-multisig.s.sol
pragma solidity ^0.8.0;

import "@zeus-templates/templates/MultisigBuilder.sol";

contract MyMultisigScript is MultisigBuilder {
    function _runAsMultisig() internal override {
        // Your multisig transaction logic here
        
        // Example:
        // bytes memory callData = abi.encodeWithSignature("updateParameter(uint256)", newValue);
        // execute(targetAddress, 0, callData);
    }
    
    function testMultisigTx() public {
        // Test multisig transaction
    }
}
```

## Testing Your Upgrade

Before registering your upgrade, test it with:

```bash
zeus test --env MyFirstEnv ./path/to/my/script.s.sol
```

## Registering Your Upgrade

Register your upgrade with Zeus to make it available for deployment:

```bash
zeus upgrade register
```

This records the current commit that your upgrade belongs to, ensuring all parties execute on the same codebase.

## Checking Upgrade Availability

Verify that your upgrade is available for a specific environment:

```bash
zeus upgrade list --env MyFirstEnv
```

## Next Steps

After creating and registering your upgrade, you're ready to:

- [Learn how to run deployments](/migrations/running-deployments)
- [Manage environments](/environments/overview)