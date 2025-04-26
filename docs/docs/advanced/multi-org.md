---
sidebar_position: 3
title: Multi-Organization Deployments
description: Coordinating deployments across multiple organizations
---

# Multi-Organization Deployments

Zeus excels at coordinating deployments involving multiple organizations, which is common in decentralized protocols. This guide covers best practices for multi-org deployments.

## Multi-Org Deployment Challenges

Coordinating deployments across organizations presents several challenges:

1. **Trust Requirements**
   - Different organizations may have varying levels of trust
   - Each org needs to verify actions independently

2. **Coordination Overhead**
   - Synchronizing actions across different teams
   - Managing timezones and availability

3. **Consistent Environments**
   - Ensuring all organizations have the same view of the system
   - Preventing divergent state

4. **Transparent Verification**
   - Providing clear verification paths for all parties
   - Establishing shared understanding of success criteria

## Zeus Solutions for Multi-Org Deployments

### Shared Metadata Repository

Zeus's metadata repository provides a single source of truth:

```bash
# During initialization
zeus init --metadata-repo https://github.com/shared-org/protocol-metadata.git
```

Benefits:
- Transparent record of all deployments
- Consistent view of contract addresses
- Shared environment parameters
- Traceable deployment history

### Multi-Org Multisig Integration

Zeus integrates with multi-organization multisigs:

```solidity
contract MultiOrgExample is MultisigBuilder {
    function _runAsMultisig() internal override {
        // Get the shared multisig address
        address sharedMultisig = zAddress("SHARED_MULTISIG");
        
        // Prepare transaction for approval by multiple organizations
        bytes memory upgradeCall = abi.encodeWithSignature(
            "upgrade(address)", 
            newImplementation
        );
        
        // Execute transaction through the multisig
        execute(proxyAdmin, 0, upgradeCall);
    }
}
```

Benefits:
- Requires consensus across organizations
- Provides clear approval flows
- Enforces governance rules

### Verification Workflows

Zeus enables transparent verification for all parties:

```bash
# Each organization can independently verify
zeus deploy verify --env mainnet
```

Sample verification output:
```
✓ Contract MyContract at 0x123... verified
✓ Contract Registry at 0x456... verified
```

Benefits:
- Independent verification by each organization
- Clear success/failure indicators
- Deterministic bytecode validation

## Multi-Org Deployment Patterns

### The Phased Approval Pattern

Structure deployments to require approval at key phases:

```
my-upgrade/
  upgrade.json
  1-prepare.s.sol      # OrgA approval required
  2-deploy.s.sol       # OrgB approval required
  3-configure.s.sol    # OrgC approval required
  4-activate.s.sol     # All orgs approval required
```

Benefits:
- Distributes responsibility across organizations
- Provides clear checkpoints
- Allows specialized expertise at each phase

### The Multi-Multisig Pattern

Use different multisigs for different aspects of the deployment:

```solidity
contract MultiMultisigExample is MultisigBuilder {
    function _runAsMultisig() internal override {
        // Parameter governance multisig (Org A+B)
        address paramMultisig = zAddress("PARAM_MULTISIG");
        
        // Contract upgrade multisig (Org B+C)
        address upgradeMultisig = zAddress("UPGRADE_MULTISIG");
        
        // Emergency multisig (All orgs)
        address emergencyMultisig = zAddress("EMERGENCY_MULTISIG");
        
        // Note: In an actual implementation, you would set the correct
        // multisig using configuration or script parameters, rather than
        // having multiple transactions in one script
        
        // Prepare parametrization transaction
        bytes memory paramCall = abi.encodeWithSignature(
            "setParameter(string,uint256)", 
            "MAX_LOCK_DURATION",
            365 days
        );
        
        // Execute parametrization through the multisig
        execute(controller, 0, paramCall);
    }
}
```

Benefits:
- Separates concerns by responsibility
- Enables specialized governance for different functions
- Provides flexibility in org participation

### The Escrow Pattern

Use temporary contracts as coordination points:

```solidity
contract EscrowPatternExample is EOADeployer {
    function runAsEOA() internal override {
        // Deploy new implementation
        address newImpl = deploySingleton(
            "NewImplementation", 
            type(NewImplementation).creationCode
        );
        
        // Deploy escrow contract that holds the implementation
        // until all orgs approve
        address escrow = deploySingleton(
            "UpgradeEscrow", 
            type(UpgradeEscrow).creationCode, 
            abi.encode(newImpl)
        );
        
        // Record escrow for next phase
        zUpdate("UPGRADE_ESCROW", escrow);
    }
}

// Later phase, after all orgs verify the implementation
contract EscrowReleaseExample is MultisigBuilder {
    function _runAsMultisig() internal override {
        // Get escrow address
        address escrow = zAddress("UPGRADE_ESCROW");
        
        // Execute release transaction
        bytes memory releaseCall = abi.encodeWithSignature("release()");
        
        execute(escrow, 0, releaseCall);
    }
}
```

Benefits:
- Provides clear verification checkpoints
- Creates transparent approval processes
- Ensures all orgs can verify before activation

## Multi-Org Coordination Tools

### Deployment Checklist

Create a shared deployment checklist:

```markdown
# Multi-Org Deployment Checklist

## Pre-Deployment
- [ ] Org A: Verify contract code
- [ ] Org B: Prepare multisig
- [ ] Org C: Confirm parameters

## Deployment Phase 1
- [ ] Org A: Execute and verify Phase 1
- [ ] All Orgs: Verify Phase 1 output

## Deployment Phase 2
- [ ] Org B: Approve multisig transaction
- [ ] Org C: Approve multisig transaction
- [ ] All Orgs: Verify Phase 2 output

## Post-Deployment
- [ ] Org A: Verify final state
- [ ] Org B: Confirm functionality
- [ ] Org C: Document deployment
```

### Communication Plan

Establish a clear communication plan:

1. **Pre-Deployment Briefing**
   - Review deployment plan with all orgs
   - Assign responsibilities
   - Establish communication channels

2. **Execution Coordination**
   - Real-time communication during deployment
   - Status updates at each phase
   - Immediate notification of any issues

3. **Verification Coordination**
   - Each org reports verification results
   - Cross-verification of findings
   - Documentation of verification steps

## Best Practices

1. **Transparent Documentation**
   - Document all deployment steps in advance
   - Share verification procedures with all orgs
   - Record all decisions and approvals

2. **Independent Verification**
   - Each org should verify independently
   - Cross-check verification results
   - Document verification findings

3. **Clear Responsibility Matrix**
   - Define which org is responsible for what
   - Establish approval thresholds for each action
   - Document escalation procedures

4. **Dry Runs**
   - Perform complete dry runs on testnets
   - Involve all orgs in testnet deployments
   - Use testnet runs to refine coordination

5. **Contingency Planning**
   - Establish clear rollback procedures
   - Define communication protocols for emergencies
   - Document decision-making authority during incidents

## Case Study: Multi-Org Protocol Deployment

A typical multi-org protocol deployment might follow this pattern:

1. **Core Contract Deployment (Org A)**
   - Deploy core protocol contracts
   - All orgs verify the deployment

2. **Parameter Configuration (Org B)**
   - Set initial parameters via multisig
   - All orgs verify parameters

3. **Access Control Setup (All Orgs)**
   - Configure roles for each organization
   - Each org verifies their access

4. **Protocol Activation (Multi-Org Multisig)**
   - Final activation requires all orgs
   - Each org signs the activation transaction

This approach ensures that no single organization controls the entire deployment process, while providing clear verification points for all parties.

## Next Steps

- [Learn about deployment verification](/advanced/verification)
- [Explore common deployment patterns](/advanced/patterns)