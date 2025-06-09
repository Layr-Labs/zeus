---
sidebar_position: 2
title: Environment Configuration
description: Managing environment settings and parameters
---

# Environment Configuration

Zeus environments can be configured with various parameters to customize deployment behavior. This guide covers how to set up and configure environments effectively.

## Configuration File Location

Zeus searches for a `.zeus` configuration file in your repository, beginning at the root directory. If no configuration file is found at the root level, Zeus will search subdirectories and use the `.zeus` file located closest to the root. When your `.zeus` file is located in a subdirectory, make sure to run Zeus commands from that subdirectory's location.

## Creating a New Environment

To create a new environment, use the `zeus env new` command:

```bash
zeus env new
```

You'll be prompted to provide information about the environment:

- Environment name (e.g., `mainnet`, `sepolia`, `staging`)
- Version (typically starts at `0.0.0`)
- Network (e.g., `ethereum`, `arbitrum`, `optimism`)

## Environment Scalar Parameters

Each environment maintains a set of scalar parameters that your deployment scripts can access. These parameters can include:

- Contract configuration values
- Feature flags
- Addresses for external dependencies
- Network-specific settings

### Viewing Parameters

To view the parameters in an environment:

```bash
zeus env show <env-name>
```

### Setting Parameters

Parameters are primarily set in your deployment scripts using the Zeus script API:

```solidity
// Setting parameters in a deployment script
function runAsEOA() internal override {
    // Set a parameter
    zUpdate("PROTOCOL_NAME", "MyProtocol");
    zUpdate("MAX_SUPPLY", 1000000 * 10**18);
    zUpdate("TREASURY", address(0x123...));
    zUpdate("TRANSFERS_ENABLED", true);
}
```

### Reading Parameters

Parameters can be read in your deployment scripts:

```solidity
// Reading parameters in a deployment script
function runAsEOA() internal override {
    string memory name = zString("PROTOCOL_NAME");
    uint256 maxSupply = zUint("MAX_SUPPLY");
    address treasury = zAddress("TREASURY");
    bool transfersEnabled = zBool("TRANSFERS_ENABLED");
    
    // Use these values in your deployment
    // ...
}
```

## Parameter Types

Zeus supports the following parameter types:

| Type | Description | Set Method | Get Method |
|------|-------------|------------|------------|
| `string` | Text values | `zUpdate(string, string)` | `zString(string)` |
| `uint256` | Unsigned integers | `zUpdate(string, uint256)` | `zUint(string)` |
| `int256` | Signed integers | `zUpdate(string, int256)` | `zInt(string)` |
| `bool` | Boolean values | `zUpdate(string, bool)` | `zBool(string)` |
| `address` | Ethereum addresses | `zUpdate(string, address)` | `zAddress(string)` |
| `bytes` | Arbitrary binary data | `zUpdate(string, bytes)` | `zBytes(string)` |
| `bytes32` | Fixed-size 32-byte data | `zUpdate(string, bytes32)` | `zBytes32(string)` |

## Environment Files

Zeus environments are stored in your metadata repository (specified during `zeus init`). The structure typically looks like:

```
my-metadata-repo/
  environments/
    mainnet.json
    sepolia.json
    ...
```

Each environment file contains:
- Environment metadata (name, version, network)
- Scalar parameters
- Contract registry (addresses of deployed contracts)
- Deployment history

While you can manually edit these files, it's generally safer to use Zeus commands to modify environments.

## Environment Best Practices

1. **Use Clear Naming Conventions**
   - Use descriptive names for your parameters
   - Follow a consistent naming pattern (e.g., all caps with underscores)

2. **Documentation**
   - Document parameters in code comments
   - Keep a shared document of parameter meanings for team reference

3. **Initialization**
   - Initialize all parameters in your first deployment script
   - Use defensive coding to handle missing parameters

4. **Validation**
   - Add parameter validation in your deployment scripts
   - Verify parameter values are in expected ranges

5. **Version Control**
   - Track environment changes with descriptive commit messages
   - Consider using branches for major environment changes

## Common Environment Parameters

Here are some common parameters you might want to include:

```solidity
// Network parameters
zUpdate("IS_TESTNET", true);
zUpdate("CHAIN_ID", 11155111); // Sepolia

// Protocol parameters
zUpdate("PROTOCOL_VERSION", "1.0.0");
zUpdate("PROTOCOL_FEE_BPS", 50); // 0.5%

// Governance parameters
zUpdate("GOVERNANCE_MULTISIG", address(0x123...));
zUpdate("TREASURY", address(0x456...));

// Feature flags
zUpdate("TRANSFERS_ENABLED", true);
zUpdate("STAKING_ENABLED", false);
```

## Next Steps

- [Learn about environment best practices](/environments/best-practices)
- [Learn about common deployment pitfalls](/migrations/common-pitfalls)
