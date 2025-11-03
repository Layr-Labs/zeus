---
sidebar_position: 3
title: Common Pitfalls
description: Avoiding common issues when using Zeus for deployments
---

# Common Deployment Pitfalls

When working with Zeus deployments, there are several common pitfalls that teams can encounter. This guide helps you identify and avoid these issues.

## Forge Version Mismatches

One of the most common issues in multi-developer teams is using different Forge versions.

### Problem

Different Forge versions can produce slightly different bytecode for the same source code, leading to verification failures when team members get different results.

### Solution

Always ensure your entire team is using the same version of Forge:

```bash
# Check your current Forge version
forge --version

# If needed, install a specific version
foundryup -v 0.2.0 # Replace with your team's agreed version
```

Add the Forge version to your project documentation and consider adding a check in your CI/CD pipeline to verify the correct version is being used.

## Verification Failure

### Problem

When on the same commit hash, verifying a deployment can fail if the metadata hash locally does not match the metadata hash of the contract that is deployed.

### Solution

Option 1: In your `foundry.toml` set `bytecode_hash = "none"`. 

Option 2: Pin solc version in `foundry.toml`. 

## Working on Different Git Commits

### Problem

When team members work from different commits, they may end up with different contract code, leading to discrepancies in bytecode and deployment behavior.

### Solution

Always ensure everyone is working from the same commit when performing deployments:

```bash
# Pull the latest changes and checkout the agreed-upon commit
git fetch
git checkout <specific-commit-hash>

# Verify the current commit
git rev-parse HEAD
```

For critical deployments, it's good practice to tag the specific commit you're deploying from:

```bash
git tag -a deployment-v1.0.0 -m "Production deployment v1.0.0"
git push origin deployment-v1.0.0
```

## Inconsistent Build Environment

### Problem

Stale build artifacts or outdated dependencies can lead to unexpected behavior.

### Solution

Always start with a clean build environment before any deployment:

```bash
# Update submodules
git submodule update --init --recursive

# Clean build artifacts
forge clean

# Rebuild contracts
forge build
```

Adding this as a pre-deployment checklist item helps ensure everyone has a consistent build environment.

## Overlooking Dependency Changes

### Problem

Changes in dependencies (like OpenZeppelin contracts) can affect your deployment.

### Solution

Lock your dependencies to specific versions and commits in your Foundry configuration:

```toml
# foundry.toml or remappings.txt
@openzeppelin/contracts=lib/openzeppelin-contracts/contracts
```

And specify exact commit hashes in your `.gitmodules` file:

```
[submodule "lib/openzeppelin-contracts"]
	path = lib/openzeppelin-contracts
	url = https://github.com/OpenZeppelin/openzeppelin-contracts
	branch = v4.8.0
```

## Zeus Environment Configuration Issues

### Problem

Using incorrect or inconsistent environment configurations across team members.

### Solution

Before starting a deployment, verify the environment configuration:

```bash
# View the current environment configuration
zeus env show <env-name>

# If needed, update environment parameters
zeus deploy run --upgrade your-setup-script --env <env-name>
```

Document all environment parameters and their expected values in your project documentation.

## Multisig Coordination Failures

### Problem

Inadequate coordination among multisig signers can delay deployments or lead to incomplete transactions.

### Solution

1. Schedule deployment windows when all required signers are available
2. Use Zeus to prepare transactions in advance:
   ```bash
   zeus deploy run --upgrade <deployment> --env <env>
   ```
3. Share the deployment plan with all signers before execution
4. Establish clear communication channels during the deployment process

## Pre-Deployment Checklist

Before any important deployment, run through this checklist:

```markdown
# Zeus Deployment Pre-Flight Checklist

## Environment
- [ ] Forge version matches team standard: `forge --version` = v0.x.y
- [ ] All team members on same commit: `git rev-parse HEAD` = 0xabcdef...
- [ ] Clean build environment: `git submodule update --recursive && forge clean && forge build`

## Configuration
- [ ] Environment parameters verified: `zeus env show <env>`
- [ ] Required signers confirmed and available
- [ ] Network configuration verified (RPC URLs, chain IDs)

## Contracts
- [ ] All contract tests passing: `forge test`
- [ ] Contract verification process documented
- [ ] Deployment sequence documented and understood by team

## Recovery
- [ ] Rollback procedure defined
- [ ] Emergency contacts list prepared
- [ ] Test environment validated with identical deployment steps
```

Following these practices will help your team avoid common pitfalls and ensure smoother deployments with Zeus.

## Next Steps

- [Learn how to run deployments](/migrations/running-deployments)
- [Understand environment management](/environments/overview)
