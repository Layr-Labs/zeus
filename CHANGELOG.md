0.1.0:
- Changed the core contracts to emit events while communicating with Zeus instead of using return types.
    - why: events are more highly structured, can be parsed via the ZeusScript ABI, and don't require manual tuple parsing.
- `zeus env show <env>` now prints all of the contracts and environment parameters associated with an environment.

0.0.8:
- `zeus test` now supports running a glob of tests (`zeus test --env testnet my/path/*.sol`)
- etherscan verification now integrated.
- Added the "script" phase, which can run a command as part of an upgrade.
- Support `zUpdate` for modifying environment state from within a deploy.