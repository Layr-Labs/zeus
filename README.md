# Installing zeus

## Prerequisites:
- Node 22 (`node --version` to check)

## Install with:
- `npm install -g https://d2mlo472ao01at.cloudfront.net/zeus-1.0.0.tgz`

## Running Zeus Consumer Tests
- `zeus test --env <env> ./path/to/upgrade/script.s.sol` (NOTE: this accepts a glob / multiple arguments)

## Seeing an environment
- `zeus env show <env>`

## Running a deploy:

1. See if your upgrade is available to run in your environment:
    - `zeus upgrade list --env <env>`

2. If it's there, great. If it's not, your environment is either on the wrong version OR you didn't register your upgrade.

    To see if you registered your upgrade at all, check:
    - `zeus upgrade list`

    If your upgrade isn't in that list, you need to register it. Make sure you're on the correct commit you want 
    everyone to run your upgrade from, and then run;

    - `zeus upgrade register` and follow the on-screen instructions.

3. Start your deploy!

    - `zeus deploy run --upgrade <directory name> --env <env>`
    NOTE: `directory name` is what Zeus uses right now to identify upgrades.

4. Your deploy may halt periodically in between steps. You can resume your deploy with:

    - `zeus deploy run --resume --env <env>`

## Verifying a deploy

- While a deploy is ongoing, you can run:
    `zeus deploy verify --env <env>`

To verify that the contracts this deploy claims to have produced match what is available in the repository.

- HOW: Zeus uses an algorithm that compares your local bytecode, with immutableReferences zero'd out, against bytecode that is available onchain (with the same bytecode segments zero'd out).
- NOTE: Make sure you double check your foundry version (forge --version) before doing this. Differences in forge versions have been known to affect hash calculations.
- NOTE: If you are logged in and have write access to the ZEUS_HOST, you will automatically post a small commit indicating that you verified those contracts locally.

## Cancelling a deploy

- You may be able to cancel a deploy, depending on what state it is in. 

    `zeus deploy cancel --env <env>`

