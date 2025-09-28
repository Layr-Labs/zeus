# Zeus Development Commands

## Development Workflow Commands

### Building
- `npm run build` - Compile TypeScript to JavaScript (development build)
- `npm run build-dev` - Build site + webpack dev bundle
- `npm run build-prod` - Build site + webpack production bundle
- `npm run build-site` - Build documentation site only
- `npm run watch` - Watch mode with webpack dev config

### Testing
- `npm test` - Run all tests with coverage (runs in band for reliability)
- `npm run test-coverage` - Same as test (coverage always included)
- `npm run test-debug` - Run tests with Node.js debugger attached

### Code Quality
- `npm run lint` - Run ESLint on all TypeScript source files
- `npm run lint-fix` - Run ESLint with automatic fixes

### Running the CLI
- `npm start` - Run the compiled CLI from dist/index.js
- `npm run debug` - Run with Node.js debugger attached

### Package Management
- `npm run prepack` - Prepare package for publishing (builds site + prod bundle)

## Zeus CLI Commands (when installed globally)
- `zeus login` - Authenticate with GitHub
- `zeus init` - Initialize Zeus in a project
- `zeus env new` - Create a new environment
- `zeus env show <env>` - View environment details
- `zeus env list` - List all environments
- `zeus upgrade register` - Register an upgrade
- `zeus upgrade list [--env <env>]` - List available upgrades
- `zeus deploy run --upgrade <dir> --env <env>` - Run a deployment
- `zeus deploy run --resume --env <env>` - Resume a deployment
- `zeus deploy status --env <env>` - Check deployment status
- `zeus deploy verify --env <env>` - Verify deployed contracts
- `zeus deploy cancel --env <env>` - Cancel a deployment
- `zeus test --env <env> <script>` - Test upgrade scripts
- `zeus which <contract>` - Find contract addresses
- `zeus run` - Run binaries with contract addresses
- `zeus shell` - Interactive shell with Zeus context

## System Requirements
- **Node.js**: Version 22+ required
- **Forge**: Required for smart contract operations
- **Platform**: Supports macOS (Darwin), likely Linux/Windows as well

## Prerequisites for Development
1. Install Node.js 22+
2. Install Forge
3. Clone repository and run `npm install`
4. For testing Zeus commands, install globally: `npm install -g @layr-labs/zeus`