
**[Current]** 
1.1.2:
- Bump to support custom derivation paths.

1.1.1:
- Minor patches to the zeus state machine to make errors more legible.

1.1.0:
- Complete rewrite of the ledger integration, with an emphasis on viem+ledger. Multisig ledger phases now work properly.

1.0.6:
- disables gnosis verification (cringe)

**[Historical]** 
1.0.1:
    - `zeus test` now accepts an optional rpcUrl. Note that the RPC is checked to match the chainId
      of the specified environment.
    - `multisig` steps now run `zeus test` automatically during deploys.
    - removed the behavior of automatically stopping after segments of the deploy.
    - fixed an unnecessary prompt for the etherscan api key
      
1.0.0:
    bugfixes:
        - `zeus verify` no longer prompts for an etherscan api key.
        - `zeus deploy cancel` no longer unnecessarily prompts for a strategy in cases where a transaction is not needed to abort the deploy.
        - major refactor to the core deploy logic to enable deeper testing.
        - fixed a bug where zeus could not find the forge metadata
        - fixed a bug where the etherscan API key was requested multiple times.
    features:
        - [BETA] Introduce: `zeus deploy run [--fork anvil]`, which can be used to apply several protocol upgrades onto a local anvil.
        - `zeus which` now searches for both deployed contracts _and_ environment parameters.
        - Multisig steps will now check onchain that the provided address is a signer for the SAFE before proceeding. 
        - Multisig + EOA steps now support signing with a non-default derivation path.

0.5.5:
- Fixed the script phase.

0.5.4:
- Fixes: 
    - `zeus upgrade list`, which erroneously stated that it required being logged in.
    - The onchain multisig strategy now warns if being used for a non 1/N multisig.
    - Fixes the script phase, which failed unnecessarily.
    - Added warnings to 1/N vs. non-1/N multisigs.

0.5.2:
- Fixes an arbitrary restriction on upgrade name length

0.5.1:
- `zeus upgrade new` has been renamed `zeus upgrade register` and now supports updating existing upgrades.
- `zeus which` now supports addresses, and will tell you what an address is on any network. Neat!

**[historical]**
0.5.0:
- zeus now supports logged out mode

0.4.3:
- `zeus test` output is now colored. 

0.4.2:
- Fixes an issue with the Gnosis API, caused by an earlier change to MultisigTransaction communication.

0.4.1:
- Linux support

**[past]**
0.4.0:
- Support for the updated `options()` syntax in multisig upgrade scripts.

0.3.3:
- `zeus deploy verify` no longer fails if it can't write to the repo.
- Fixed a bug where the multisig step incorrectly reported multiple transactions.
- Introduced support for Testnet 1/N Multisig Immediate execution.

0.3.1:
- Uses --slow on forge by default.

0.2.1:
- Added support for Uint8 and Uint16 in zeus states.

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