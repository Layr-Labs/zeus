---
sidebar_position: 1
title: Deployment Verification
description: Ensuring correctness and security of deployments
---

# Deployment Verification

Zeus provides mechanisms to verify that your contracts are deployed correctly and securely. This guide explains verification approaches and best practices.

## Bytecode Verification

Zeus's built-in verification compares local bytecode against on-chain bytecode:

```bash
zeus deploy verify --env <env-name>
```

This works by:
1. Compiling your contract locally with the same compiler version and settings
2. Retrieving the bytecode of the deployed contract from the blockchain
3. Comparing the two bytecodes, accounting for immutable references

### Handling Immutable References

Immutable variables in contracts cause bytecode differences between compile-time and runtime. Zeus handles this by:

1. Zero-ing out immutable references in both the local and on-chain bytecode
2. Comparing the standardized bytecodes

This ensures that the core logic is identical while accounting for expected differences from immutable variables.

## Block Explorer Verification

In addition to Zeus's internal verification, you should verify contracts on block explorers:

1. **Etherscan Verification**:
   - Use Etherscan's verification tools
   - Consider plugins like `hardhat-etherscan` for automated verification

2. **Multiple Explorer Verification**:
   - Verify on all relevant explorers (Etherscan, Arbiscan, etc.)
   - Use services like Sourcify for cross-explorer verification

## Verification Checklist

Use this checklist for comprehensive verification:

```markdown
# Contract Verification Checklist

## Bytecode Verification
- [ ] Zeus bytecode verification successful
- [ ] Block explorer verification completed
- [ ] Compiler version and settings documented

## Access Control Verification
- [ ] Owner addresses match expected values
- [ ] Admin roles assigned correctly
- [ ] No unexpected privileged roles

## Parameter Verification
- [ ] All contract parameters match expected values
- [ ] Initializers called with correct arguments
- [ ] No uninitialized components

## External Dependencies
- [ ] All external contract addresses verified
- [ ] External contract interactions tested
- [ ] No unexpected external dependencies

## Functional Verification
- [ ] Core functionality tested on-chain
- [ ] Edge cases and failure modes tested
- [ ] Upgrade mechanisms verified
```

## Common Verification Issues

Be aware of these common verification challenges:

1. **Compiler Version Mismatches**:
   - Always document exact compiler version used for deployment
   - Use the same compiler version for verification

2. **Optimization Differences**:
   - Use the same optimization settings for verification
   - Document runs parameter and other optimizer settings

3. **Constructor Arguments**:
   - Record all constructor arguments used during deployment
   - Include ABI-encoded constructor args for explorer verification

## Next Steps

- [Learn about secure deployment patterns](/advanced/patterns)
- [Explore multi-organization deployment coordination](/advanced/multi-org)