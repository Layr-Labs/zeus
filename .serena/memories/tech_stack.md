# Zeus Tech Stack

## Core Technologies
- **Language**: TypeScript with strict mode enabled
- **Runtime**: Node.js 22+ required
- **Package Manager**: npm (with package-lock.json and bun.lockb)
- **Build System**: 
  - TypeScript compiler (tsc) for development builds
  - Webpack for production bundling
  - Separate dev and prod webpack configs

## Key Dependencies
### Blockchain/Web3
- **viem**: ^2.21.15 - Ethereum library for blockchain interactions
- **@foundry-rs/hardhat-anvil**: ^0.1.7 - Foundry integration
- **@ethers-ext/signer-ledger**: ^6.0.0-beta.1 - Ledger hardware wallet support

### Multisig/Safe Integration
- **@safe-global/api-kit**: ^2.4.6 - Gnosis Safe API integration
- **@ledgerhq/hw-app-eth**: ^6.42.1 - Ledger hardware wallet Ethereum app
- **@ledgerhq/hw-transport-node-hid**: ^6.29.5 - Ledger transport layer

### CLI Framework
- **cmd-ts**: ^0.13.0 - Command-line argument parsing and validation
- **@inquirer/prompts**: ^6.0.1 - Interactive command-line prompts
- **chalk**: ^5.3.0 - Terminal string styling
- **ora**: ^8.1.0 - Elegant terminal spinners

### Utilities
- **glob**: ^11.0.0 - File pattern matching
- **semver**: ^7.6.3 - Semantic versioning utilities
- **compare-versions**: ^6.1.1 - Version comparison
- **ajv**: ^6.12.6 - JSON schema validation
- **express**: ^4.21.0 - Web server for local interfaces

## Development Tools
### Testing
- **Jest**: ^29.7.0 with ts-jest for TypeScript support
- **@jest/globals**: ^29.7.0
- Coverage reporting with HTML and LCOV formats
- Test files: `**/*.spec.ts` pattern

### Linting & Code Quality
- **ESLint**: ^9.13.0 with TypeScript ESLint integration
- **typescript-eslint**: ^8.12.2 - TypeScript-specific linting rules
- Strict configuration with stylistic rules
- Custom rule for unused variables with underscore prefix ignore pattern

### Build & Bundling
- **TypeScript**: ^5.6.3 with strict mode
- **Webpack**: ^5.95.0 with CLI and loaders
- **ts-loader**: ^9.5.1 - TypeScript loader for Webpack
- **copy-webpack-plugin**: ^13.0.0 - Asset copying
- **webpack-node-externals**: ^3.0.0 - Node.js externals handling