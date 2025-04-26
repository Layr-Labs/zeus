---
sidebar_position: 1
slug: /
title: Zeus Documentation
---

# Zeus Documentation

![unit tests](https://github.com/Layr-Labs/zeus/actions/workflows/ci-pipeline.yml/badge.svg)
[![codecov](https://codecov.io/gh/Layr-Labs/zeus/branch/master/graph/badge.svg?token=E8DQQ7BW8E)](https://codecov.io/gh/Layr-Labs/zeus)
[![npm version](https://badge.fury.io/js/@layr-labs%2Fzeus.svg)](https://badge.fury.io/js/@layr-labs%2Fzeus)

Zeus manages complex deploy processes for onchain software.

## Should I use Zeus?

You may find Zeus useful if:
- You use forge, `forge create` or `forge script` to deploy your projects.
- You use multiple multisigs to deploy your onchain software. (i.e for permissioned proxy/implementation upgrades)
- You have multiple deploy environments (i.e. testnet vs mainnet) and want to automatically track where your contracts are deployed.
  - Zeus upgrade scripts are *"write once, run anywhere"*. **No more writing a "holesky" script, and then a "mainnet" script.**

## Key Features

Zeus integrates with `forge`, and adds:
- Expressing your transactions, meant for a multisig, as a forge script. 
- Managing the lifecycle of your deploys across multiple environments. (`zeus deploy status`)
- Tracking deployed contracts across multiple environments. (`zeus which MyContract`)
- Testing your upgrade scripts (`zeus test`)
- Running binaries which require contract addresses (without hardcoding addresses) (`zeus run`)
- Generating a paper trail of all deploys, logs, and artifacts generated.

## Getting Started

- [Setting up your project](getting-started/index.md)
- [Writing your first migration](migrations/first-migration.md)
- [Managing environments](environments/overview.md)

## Examples

- [Eigenlayer Slashing Upgrade](https://github.com/Layr-Labs/eigenlayer-contracts/tree/dev/script/releases/v1.0.0-slashing)
- [Deploying a contract with an EOA](https://github.com/Layr-Labs/eigenlayer-contracts/blob/375a451862f6c56f717370b4f00a99e3508a054f/script/releases/v0.5.1-rewardsv2/1-eoa.s.sol#L20)
- [Expressing a multisig transaction](https://github.com/Layr-Labs/eigenlayer-contracts/blob/375a451862f6c56f717370b4f00a99e3508a054f/script/releases/v0.5.2-rewardsv2/2-multisig.s.sol#L57)