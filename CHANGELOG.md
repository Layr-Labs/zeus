0.2.0:
- `zeus test` now invokes `forge test` directly and provides way more sensible output.
- zeus tests are now proper forge integration tests. `ZeusScript` now extends `Test`, and can use `assertEq`.

0.1.1:
- Changed the core contracts to emit events while communicating with Zeus instead of using return types.
    - why: events are more highly structured, can be parsed via the ZeusScript ABI, and don't require manual tuple parsing.
- `zeus env show <env>` now prints all of the contracts and environment parameters associated with an environment.
- Fixed a bug with `zeus deploy cancel` which require duplicate prompts.
- Multisig steps now support `Holesky` via Protofire.

0.0.8:
- `zeus test` now supports running a glob of tests (`zeus test --env testnet my/path/*.sol`)
- etherscan verification now integrated.
- Added the "script" phase, which can run a command as part of an upgrade.
- Support `zUpdate` for modifying environment state from within a deploy.