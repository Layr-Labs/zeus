---
sidebar_position: 3
title: Environment Best Practices
description: Guidelines for managing environments across teams and organizations
---

# Environment Best Practices

Effectively managing Zeus environments is crucial for successful deployments, especially when working with multiple teams or organizations. This guide outlines best practices for environment management.

## Environment Organization

### Environment Naming

Use a consistent naming scheme for environments:

- **Network-focused**: `mainnet`, `sepolia`, `arbitrum`, `optimism`
- **Stage-focused**: `development`, `staging`, `production`
- **Combined approach**: `mainnet-prod`, `sepolia-staging`

### Environment Hierarchies

Consider organizing environments in a hierarchical manner:

1. **Local Development Environments**
   - For individual developer testing
   - Often ephemeral and reset frequently

2. **Shared Test Environments**
   - For team testing and integration
   - On public testnets like Sepolia or Goerli

3. **Staging Environments**
   - Mirror production but on testnets
   - For final pre-production validation

4. **Production Environments**
   - Mainnet deployments
   - Carefully controlled access and changes

## Environment Access Control

### Role-Based Access

Define clear roles for environment access:

- **Viewers**: Can read environment state but not modify
- **Deployers**: Can execute deployments on specific environments
- **Admins**: Can create and configure environments

### Multisig Requirements

Set appropriate multisig requirements for different environments:

- **Development**: Single-signer may be sufficient
- **Staging**: 2-of-N multisig
- **Production**: Higher threshold (e.g., 3-of-5, 5-of-7)

## Environment Versioning

### Version Strategies

Adopt a deliberate versioning strategy:

- **Semantic Versioning**: `major.minor.patch` (e.g., `1.2.3`)
- **Date-Based**: `YYYY.MM.DD` (e.g., `2025.04.26`)
- **Sprint-Based**: `sprint-XX` (e.g., `sprint-42`)

### Upgrade Paths

Plan clear upgrade paths between environment versions:

- Define which upgrades can be applied to which versions
- Document version compatibility requirements
- Consider parallel upgrade tracks for different features

## Environment Synchronization

### Cross-Environment Parameters

Manage parameters that need to be consistent across environments:

- Use parameter prefixes to distinguish local vs. global parameters
- Document which parameters must match across environments
- Consider automated tooling to verify parameter consistency

### Contract Verification

Implement thorough verification procedures:

- Verify all deployed contracts on block explorers
- Maintain local verification records with Zeus
- Cross-check contract addresses across environments when appropriate

## Environment Documentation

### Change Logs

Maintain detailed environment change logs:

- Record all significant environment changes
- Document parameter modifications
- Note when and why contracts were redeployed

### Parameter Dictionary

Create a parameter dictionary:

```markdown
# Environment Parameter Dictionary

## Network Parameters
- `CHAIN_ID` (uint256): Ethereum chain ID
- `IS_TESTNET` (bool): Whether this is a testnet environment

## Protocol Parameters
- `MAX_SUPPLY` (uint256): Maximum token supply
- `PROTOCOL_FEE_BPS` (uint256): Protocol fee in basis points

## Governance Parameters
- `GOVERNANCE_MULTISIG` (address): Address of governance multisig
- `TREASURY` (address): Address of protocol treasury
```

## Deployment Workflows

### Continuous Integration

Integrate Zeus with CI/CD pipelines:

- Run `zeus test` on all PRs
- Automate deployment to development environments
- Require manual approval for staging/production deployments

### Deployment Checklist

Create a deployment checklist for production environments:

```markdown
# Production Deployment Checklist

## Pre-Deployment
- [ ] All tests passing locally and in CI
- [ ] Deployment successfully executed on staging
- [ ] Contract verification successful on staging
- [ ] Security review completed
- [ ] Multisig signers briefed and available

## Deployment
- [ ] Execute `zeus deploy run` with correct parameters
- [ ] Monitor deployment progress
- [ ] Coordinate multisig signing as needed

## Post-Deployment
- [ ] Verify all contracts on block explorer
- [ ] Run `zeus deploy verify` to confirm bytecode
- [ ] Execute post-deployment validation tests
- [ ] Update documentation with new addresses
```

## Recovery Procedures

### Environment Backups

Regularly back up environment data:

- Commit environment files to version control
- Consider snapshot mechanisms for critical states
- Document recovery procedures

### Rollback Plans

Have clear rollback plans for each deployment:

- Document how to revert to previous versions
- Test rollback procedures in staging environments
- Include rollback instructions in deployment plans

## Scaling Across Organizations

### Multi-Organization Deployments

When multiple organizations are involved:

- Define clear responsibilities for each organization
- Establish shared documentation standards
- Use multi-org multisigs for critical control points

### Transparency and Auditability

Maintain transparent and auditable processes:

- Record all deployment decisions and justifications
- Provide verification tools for external parties
- Document the complete deployment lifecycle

## Next Steps

- [Learn about common deployment pitfalls](/migrations/common-pitfalls)
- [Learn about deployment verification](/advanced/verification)