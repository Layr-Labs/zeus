# Zeus Architecture Overview

## High-Level Architecture

Zeus is a CLI tool for managing complex smart contract deployments with the following key architectural components:

### Command Structure
- **Hierarchical Commands**: Main commands (deploy, env, upgrade, login) with subcommands
- **Entry Point**: `src/index.ts` with main function handling version checks and command routing
- **Command Implementation**: Each command group has its own directory under `src/commands/`

### Core Components

#### 1. Signing Strategies (`src/signing/`)
- **EOA Strategies**: Private key and Ledger hardware wallet support
- **Multisig Strategies**: Gnosis Safe integration with multiple interfaces
  - Web-based signing
  - API-based transactions
  - On-chain execution
- **Strategy Pattern**: Pluggable signing mechanisms for different wallet types

#### 2. Deployment Handlers (`src/deploy/handlers/`)
- **Base Handler**: Common deployment logic
- **EOA Handler**: Single-signature deployments
- **Gnosis Handler**: Multisig transaction building and execution
- **Script Handler**: Forge script integration
- **System Handler**: System-level operations

#### 3. Metadata Management (`src/metadata/`)
- **GitHub Integration**: Stores deployment metadata in GitHub repositories
- **Local Clone**: Alternative local storage mechanism
- **Schema Validation**: JSON schema-based validation for metadata
- **Transaction Tracking**: Audit trail for all deployment operations

#### 4. Environment Management
- **Scalar Parameters**: Configuration values per environment
- **Contract Registry**: Tracks deployed contract addresses
- **Version Management**: Semantic versioning with upgrade constraints

### Key Design Patterns

#### Command Pattern
- Each CLI command is implemented as a separate module
- Clear separation between command parsing and business logic
- Consistent error handling and user feedback

#### Strategy Pattern  
- Multiple signing strategies for different wallet types
- Pluggable deployment handlers for different execution contexts
- Extensible metadata storage backends

#### Builder Pattern
- Transaction building for complex multisig operations
- Environment configuration construction
- Upgrade manifest creation

### Integration Points

#### External Dependencies
- **Forge**: Smart contract compilation and deployment
- **GitHub API**: Metadata storage and collaboration features
- **Blockchain Networks**: Direct interaction via viem
- **Hardware Wallets**: Ledger device integration
- **Gnosis Safe**: Multisig wallet integration

#### File System Integration
- **Project Configuration**: `.zeus` directory for project settings
- **Upgrade Scripts**: Forge Solidity scripts for deployment logic
- **Artifact Management**: Generated deployment artifacts and logs

### Data Flow
1. **Command Input**: CLI arguments parsed and validated
2. **Configuration Loading**: Project and environment settings loaded
3. **Strategy Selection**: Appropriate signing/deployment strategy chosen
4. **Transaction Building**: Deployment operations constructed
5. **Execution**: Transactions signed and submitted
6. **Metadata Update**: Results stored in metadata repository
7. **Artifact Generation**: Logs and artifacts saved locally

### Security Considerations
- **Private Key Handling**: Secure storage and transmission
- **Hardware Wallet Integration**: Ledger device communication
- **Multisig Validation**: Transaction verification before signing
- **Metadata Integrity**: GitHub-based audit trails