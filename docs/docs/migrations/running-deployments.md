---
sidebar_position: 2
title: Running Deployments
description: Guide to executing and monitoring deployments
---

# Running Deployments

After you've created and registered your upgrade, you'll need to execute it in your target environment.

## Starting a Deployment

To start a deployment, use the `zeus deploy run` command:

```bash
zeus deploy run --upgrade <directory-name> --env <env-name>
```

Where:
- `<directory-name>` is the name of your upgrade directory
- `<env-name>` is the name of your target environment

## Handling Multi-phase Deployments

Zeus deployments may halt periodically between steps, especially when a multisig transaction requires approval. To resume a deployment after a halt:

```bash
zeus deploy run --resume --env <env-name>
```

## Monitoring Deployment Status

To check the status of a running deployment:

```bash
zeus deploy status --env <env-name>
```

This shows the current state of your deployment, including completed steps and any pending transactions.

## Verifying Deployed Contracts

During or after a deployment, you can verify that the contracts deployed match the expected bytecode:

```bash
zeus deploy verify --env <env-name>
```

This compares your local bytecode (with immutable references zeroed out) against the bytecode available on-chain.

> **Note:** Ensure your foundry version (`forge --version`) matches the one used during deployment, as differences in forge versions can affect hash calculations.

When you verify contracts and are logged in with write access to the Zeus host, a verification record is automatically added to your metadata repository.

## Cancelling a Deployment

If needed, you can cancel a deployment:

```bash
zeus deploy cancel --env <env-name>
```

For multisig transactions, Zeus will attempt to propose an alternate null transaction to overwrite the nonce on-chain. Note that EOA transactions are not cancellable if they have already been executed.

## Environment Updates

Zeus environments are updated with new contract addresses and parameters only after a successful deployment. If a deployment fails, gets cancelled, or aborts, the environment in Zeus will not reflect any updated parameters.

## Next Steps

- [Learn about Zeus environments](/environments/overview)
- [Learn about common deployment pitfalls](/migrations/common-pitfalls)