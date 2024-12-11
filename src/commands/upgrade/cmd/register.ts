import {command} from 'cmd-ts';
import {json} from '../../args';
import { assertLoggedIn, inRepo, loggedIn, requires, TState } from '../../inject';
import { configs, getRepoRoot } from '../../configs';
import { search, select } from '@inquirer/prompts';
import path, { join } from 'path';
import fs from 'fs';
import { canonicalPaths } from '../../../metadata/paths';
import { execSync } from 'child_process';
import { isUpgrade, TUpgrade } from '../../../metadata/schema';
import chalk from 'chalk';


const handler = async function(_user: TState) {
  const user = assertLoggedIn(_user);
  const metaTxn = await user.metadataStore.begin();
  const zeusConfig = await configs.zeus.load();
  if (!zeusConfig) {
    throw new Error(`Can only run in repo.`);
  }

  const migrationDirectory: string = await search({
    message: 'Upgrade directory?',
    source: async (input) => {
      const migrationDirectory = join(
        getRepoRoot(),
        zeusConfig.migrationDirectory,
      );
      const contents = fs.readdirSync(migrationDirectory);
      return contents.filter((entry: string) => entry.startsWith(input ?? '') && fs.lstatSync(join(migrationDirectory, entry)).isDirectory());
    },
  });

  // check that at least 1 .s.sol file exists.
  const migrationDirAbsolute = join(
    getRepoRoot(),
    zeusConfig.migrationDirectory,
    migrationDirectory,
  );
  const migrationDirContents = fs.readdirSync(
    migrationDirAbsolute
  );
  const hasUpgradeManifest = migrationDirContents.includes('upgrade.json');

  if (!hasUpgradeManifest) {
      console.error(`* Missing upgrade.json manifest in directory(${migrationDirAbsolute}).`);
      return;
  }

  const migrationName = path.basename(migrationDirectory);

  // check to see if this repo has an existing upgrade registered for this.
  const manifest = await metaTxn.getJSONFile<TUpgrade>(
    canonicalPaths.upgradeManifest(migrationName)
  );

  let isUpdate = false;
  if (manifest._?.name !== undefined) {
    isUpdate = true;
    console.warn(`Warning: the upgrade '${migrationName}' (${manifest._.name}) already exists and will be overwritten.`)
  }

  // check that upgrade.json is valid.
  let upgrade: TUpgrade | undefined;
  try {
    const upgradeManifest = JSON.parse(fs.readFileSync(join(
      migrationDirAbsolute,
      "upgrade.json"
    ), {encoding: 'utf-8'}))
    if (!isUpgrade(upgradeManifest)) {
      console.error(`Error in 'upgrade.json' -- make sure all required fields are present.`);
      return;
    }
    upgrade = upgradeManifest;
  } catch (e) {
    console.error(`Error in 'upgrade.json' -- make sure all required fields are present and JSON is valid.`);
    console.error(e);
    return;
  }
  if (!upgrade) {
    console.error('abort');
    return;
  }

  const currentCommit = execSync('git rev-parse HEAD').toString('utf-8').trim();
  const defaultBranch = execSync('git rev-parse --abbrev-ref origin/HEAD').toString('utf-8').trim();
  const currentBranch = execSync('git branch --show').toString('utf-8').trim();

  upgrade.commit = currentCommit;

  if (defaultBranch !== currentBranch) {
    console.warn(`Warning: You are currently on (${currentBranch}), while the default branch is ${defaultBranch}. Creating an upgrade from here means that anyone applying in the future will need to checkout this non-default branch. Are you sure you want to continue?`)
    const y = await select({
      message: 'Are you sure you want to continue?',
      choices: [
        {name: 'yes', value: 'yes', description: 'Create the upgrade as-is. You can always change the commit to run this upgrade on later.'},
        {name: 'no', value: 'no', description: `Nope. I will merge my code into ${defaultBranch} and create the upgrade from there.`},
      ]
    })
    if (y !== 'yes') {
      console.error(`Aborting.`);
      return;
    }
  }
  const scripts = migrationDirContents.filter(s => s.endsWith('.s.sol'));

  console.log(`${isUpdate ? 'Updating' : 'Creating'} the following upgrade:`)
  console.log(`\t${chalk.bold(upgrade.name)}`);
  console.log(`\t\trequires: ${upgrade.from}`)
  console.log(`\t\tupgrades to: ${upgrade.to}`)
  console.log(chalk.italic(`\t\tpinned to commit: ${currentBranch}@${currentCommit}`));
  console.log();
  console.log(`\t\tDeploy phases:`)
  scripts.forEach((script, index) => {
    console.log(`\t\t\t${index + 1}. ${script}`)
  })

  const y = await select({
    message: 'Save?',
    choices: [
      {name: 'yes', value: 'yes'},
      {name: 'no', value: 'no'},
    ]
  })
  if (y !== 'yes') {
    console.error(`Aborting.`);
    return;
  }

  const upgradeManifestPersist = await metaTxn.getJSONFile(canonicalPaths.upgradeManifest(migrationName));
  upgradeManifestPersist._ = upgrade;
  upgradeManifestPersist.save();
  await metaTxn.commit(`${isUpdate ? 'Updating' : 'Creating'} upgrade ${upgrade.name}`);

  console.log(chalk.green(`+ created upgrade (${upgrade.name})`));
};

const cmd = command({
    name: 'register',
    description: 'register an upgrade with zeus -- this may create or update an existing upgrade.',
    version: '1.0.0',
    args: {
        json,
    },
    handler: requires(handler, loggedIn, inRepo),
})
export default cmd;