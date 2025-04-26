---
sidebar_position: 2
title: Zeus Development Patterns
description: Common patterns and techniques for effective Zeus usage
---

# Zeus Development Patterns

This guide outlines common patterns and techniques for developing with Zeus effectively.

## Deployment Strategy Patterns

### The Phase Pattern

Split complex deployments into clear phases:

```solidity
// Phase 1: Core contract deployment with EOA
contract Phase1CoreDeployment is EOADeployer {
    function run() public override {
        // Deploy core contracts
    }
}

// Phase 2: Configuration with multisig
contract Phase2Configuration is MultisigBuilder {
    function run() public override {
        // Configure core contracts
    }
}

// Phase 3: Integration with multisig
contract Phase3Integration is MultisigBuilder {
    function run() public override {
        // Connect contracts together
    }
}
```

Benefits:
- Clear separation of concerns
- Breaks complex migrations into manageable steps
- Allows different signers for different phases

### The Feature Toggle Pattern

Use environment parameters as feature toggles:

```solidity
contract FeatureToggleExample is EOADeployer {
    function runAsEOA() internal override {
        // Deploy base contract
        address token = deploySingleton("Token", type(Token).creationCode);
        
        // Check feature toggle
        if (zBool("ENABLE_STAKING")) {
            // Deploy and connect staking contract
            address staking = deploySingleton("Staking", type(Staking).creationCode);
            
            // Configure staking
            Staking(staking).setToken(token);
        }
    }
}
```

Benefits:
- Enables gradual feature rollout
- Provides flexibility across environments
- Simplifies testing and incremental development

## Testing Patterns

### The Test Function Pattern

Include test functions directly in deployment scripts:

```solidity
contract TestFunctionExample is EOADeployer {
    function runAsEOA() internal override {
        // Deployment logic
    }
    
    // Runs with `zeus test`
    function testDeployment() public {
        // Run deployment
        this.deploy();
        
        // Assert expected outcomes
        address registry = getDeployedAddress("Registry");
        Registry r = Registry(registry);
        
        assert(r.owner() == zAddress("EXPECTED_OWNER"));
        assert(r.isInitialized());
    }
    
    // Additional test for specific functionality
    function testRegistryFeatures() public {
        // Setup test environment
        this.deploy();
        
        // Test registry features
        address registry = getDeployedAddress("Registry");
        Registry r = Registry(registry);
        
        r.register("test", address(this));
        assert(r.lookup("test") == address(this));
    }
}
```

Benefits:
- Tests live alongside deployment code
- Automatic execution with `zeus test`
- Verifies deployment correctness

### The Mock Environment Pattern

Create dedicated testing environments:

```bash
# Create a testing environment
zeus env new --name test-env --version 0.0.0
```

```solidity
// Test-specific deployment script
contract TestEnvironmentSetup is EOADeployer {
    function runAsEOA() internal override {
        // Set testing-specific parameters
        zUpdate("IS_TEST", true);
        zUpdate("BLOCK_TIME", 1); // Fast block time for tests
        
        // Deploy mock external dependencies
        deploySingleton("MockOracle", type(MockOracle).creationCode);
        
        // Deploy system under test
        deploySingleton("Protocol", type(Protocol).creationCode);
    }
}
```

Benefits:
- Isolates testing from production environments
- Allows testing with mocked dependencies
- Enables quicker test execution

## Upgrade Patterns

### The Progressive Upgrade Pattern

Perform upgrades across multiple phases:

```
my-upgrade/
  upgrade.json
  1-prepare.s.sol
  2-upgrade.s.sol
  3-migrate.s.sol
  4-cleanup.s.sol
```

```json
// upgrade.json
{
  "name": "v2-upgrade",
  "from": "1.0.0",
  "to": "2.0.0",
  "phases": [
    { "type": "eoa", "filename": "1-prepare.s.sol" },
    { "type": "multisig", "filename": "2-upgrade.s.sol" },
    { "type": "multisig", "filename": "3-migrate.s.sol" },
    { "type": "eoa", "filename": "4-cleanup.s.sol" }
  ]
}
```

Benefits:
- Breaks complex upgrades into manageable steps
- Reduces risk through incremental changes
- Allows different signers for different phases

### The Parallel Implementation Pattern

Deploy new implementation alongside existing one:

```solidity
contract ParallelImplementation is MultisigBuilder {
    function _runAsMultisig() internal override {
        // Deploy new implementation without changing proxy
        address newImpl = deploySingleton(
            "TokenV2Impl", 
            type(TokenV2).creationCode
        );
        
        // Allow time for verification and testing
        // No proxy update yet - will happen in a later phase
        
        // Record for future reference
        zUpdate("NEW_TOKEN_IMPL", newImpl);
    }
}
```

Benefits:
- Separates deployment from activation
- Allows verification before switching
- Reduces risk during complex upgrades

## Parameter Management Patterns

### The Environment Type Pattern

Structure parameters by environment type:

```solidity
contract EnvironmentTypeExample is EOADeployer {
    function runAsEOA() internal override {
        string memory envType = zString("ENVIRONMENT_TYPE");
        
        if (keccak256(bytes(envType)) == keccak256(bytes("production"))) {
            // Production settings
            zUpdate("MAX_DEPOSITS", 1000000 ether);
            zUpdate("COOL_DOWN_PERIOD", 7 days);
        } else if (keccak256(bytes(envType)) == keccak256(bytes("staging"))) {
            // Staging settings
            zUpdate("MAX_DEPOSITS", 10000 ether);
            zUpdate("COOL_DOWN_PERIOD", 1 days);
        } else {
            // Development settings
            zUpdate("MAX_DEPOSITS", 100 ether);
            zUpdate("COOL_DOWN_PERIOD", 1 hours);
        }
    }
}
```

Benefits:
- Consistent parameter sets by environment type
- Simplifies environment creation
- Ensures appropriate settings for each context

### The Parameter Namespace Pattern

Organize parameters with namespaces:

```solidity
contract ParameterNamespaceExample is EOADeployer {
    function runAsEOA() internal override {
        // Network namespace
        zUpdate("network.chainId", 1);
        zUpdate("network.isTestnet", false);
        
        // Protocol namespace
        zUpdate("protocol.name", "MyProtocol");
        zUpdate("protocol.version", 1);
        
        // Governance namespace
        zUpdate("governance.treasury", address(0x123...));
        zUpdate("governance.multisig", address(0x456...));
    }
}
```

Benefits:
- Organizes parameters logically
- Prevents naming conflicts
- Improves parameter discoverability

## Multi-Organization Patterns

### The Role-Based Access Pattern

Implement role-based access for multi-organization deployments:

```solidity
contract RoleBasedExample is MultisigBuilder {
    function _runAsMultisig() internal override {
        // Get deployed registry
        address registry = getDeployedAddress("Registry");
        
        // Assign different roles to different organizations
        bytes memory grantAdminRole = abi.encodeWithSignature(
            "grantRole(bytes32,address)",
            keccak256("ADMIN_ROLE"),
            zAddress("ORG_A_ADMIN")
        );
        
        bytes memory grantOperatorRole = abi.encodeWithSignature(
            "grantRole(bytes32,address)",
            keccak256("OPERATOR_ROLE"),
            zAddress("ORG_B_OPERATOR")
        );
        
        // Execute these transactions
        execute(registry, 0, grantAdminRole);
        execute(registry, 0, grantOperatorRole);
    }
}
```

Benefits:
- Clear separation of responsibilities
- Enables collaboration across organizations
- Limits privileges to necessary functions

## Best Practices

1. **Keep Phases Focused**
   - Each deployment phase should have a clear, single purpose
   - Avoid mixing concerns in the same phase

2. **Plan for Rollbacks**
   - Design upgrades with rollback mechanisms
   - Test rollback procedures before deployment

3. **Documentation in Code**
   - Add detailed comments explaining deployment steps
   - Document parameter meanings and valid values

4. **Progressive Testing**
   - Test each phase individually
   - Test complete upgrade paths end-to-end

5. **Parameter Validation**
   - Validate parameters during deployment
   - Use defensive coding to handle missing or invalid parameters

## Next Steps

- [Explore multi-organization deployment coordination](/advanced/multi-org)
- [Learn about common deployment pitfalls](/migrations/common-pitfalls)