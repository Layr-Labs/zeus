---
sidebar_position: 1
title: Getting Started
description: Setting up Zeus in your project
---

# Getting Started with Zeus

Zeus manages complex deploy processes for onchain software.

## Prerequisites

Before installing Zeus, ensure you have:

- Node 22 or later (`node --version` to check)
- `forge` installed

## Setting Up a New Project with Zeus

1. **Create new GitHub repositories**
   
   You'll need two repositories:
   
   - A repository for your smart contracts project
   - A separate repository to store deployment metadata
   
   Create both repositories and install the [Zeus Deployer app](https://github.com/apps/zeus-deployer/installations/select_target) on the metadata repository.

2. **Install Zeus globally**

   ```bash
   npm install -g @layr-labs/zeus
   ```

3. **Authenticate with Zeus**

   ```bash
   zeus login
   ```

4. **Initialize Zeus in your contract repository**

   ```bash
   zeus init
   ```
   
   When prompted for your metadata repository, provide the dedicated metadata repository you created in step 1. This separate repository will store all deployment records, contract addresses, and environment configurations.

5. **Create your first environment**

   ```bash
   zeus env new
   ```
   
   This creates your first environment to deploy your contracts into.

## Next Steps

Now that Zeus is set up in your repository, you can:

- [Write your first migration](/migrations/first-migration)
- [Learn about environments](/environments/overview)
- Run Zeus tests with `zeus test`