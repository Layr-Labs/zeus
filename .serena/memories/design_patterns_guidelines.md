# Zeus Design Patterns and Guidelines

## Core Design Principles

### 1. Command-Driven Architecture
- Each CLI command is a separate module with clear responsibilities
- Commands follow a consistent structure with argument validation
- Hierarchical command organization (deploy/run, env/new, etc.)
- Error handling is standardized across all commands

### 2. Strategy Pattern Implementation
Multiple strategy patterns are used throughout Zeus:

#### Signing Strategies
- **EOA Strategies**: `privateKey.ts`, `ledger.ts`
- **Gnosis Strategies**: `web`, `api`, `onchain` variants
- **Base Strategy Interface**: All strategies implement common interface
- **Runtime Strategy Selection**: Based on configuration and user preferences

#### Deployment Handlers
- **Handler Types**: EOA, Multisig, Script, System
- **Extensible Design**: New deployment types can be added easily
- **Consistent Interface**: All handlers follow same contract

### 3. Configuration Management
- **Environment-based Config**: Separate configs per deployment environment
- **Schema Validation**: JSON schema validation for all configuration
- **Immutable Environments**: Environment state only changes on successful deployments
- **Parameter vs Contract Separation**: Scalar parameters vs deployed contract addresses

### 4. Metadata and Audit Trail
- **GitHub-based Storage**: Metadata stored in Git repositories for collaboration
- **Immutable History**: All deployment operations create permanent records
- **Structured Data**: JSON-based metadata with schema validation
- **Multi-environment Support**: Same repository tracks multiple environments

## Code Organization Guidelines

### File and Directory Structure
```
src/
├── commands/           # CLI command implementations
│   ├── deploy/cmd/     # Deploy subcommands
│   ├── env/cmd/        # Environment subcommands  
│   └── upgrade/cmd/    # Upgrade subcommands
├── signing/
│   └── strategies/     # Different signing implementations
├── deploy/handlers/    # Deployment execution handlers
├── metadata/          # Metadata storage abstractions
└── tests/             # Test files organized by feature
```

### Naming Conventions
- **Commands**: Verb-based names (`deploy`, `run`, `verify`)
- **Handlers**: Noun-based names (`eoa.ts`, `gnosis.ts`)
- **Utilities**: Function-based names (`utils.ts`, `prompts.ts`)
- **Tests**: Feature-based with `.spec.ts` suffix

### Error Handling Patterns
- **Consistent Error Types**: Standardized error handling across modules
- **User-Friendly Messages**: Clear error messages for CLI users
- **Graceful Degradation**: Fallback behaviors when possible
- **State Recovery**: Ability to resume operations after failures

### Async/Promise Patterns
- **Async/Await**: Consistent use throughout codebase
- **Error Propagation**: Proper error handling in async operations
- **Resource Cleanup**: Proper cleanup of resources and connections

## Integration Guidelines

### External Service Integration
- **GitHub API**: Centralized GitHub client with rate limiting
- **Blockchain Networks**: viem-based abstractions for different chains
- **Hardware Wallets**: Ledger integration with proper error handling
- **Forge Integration**: Shell execution with proper output parsing

### Testing Strategies
- **Unit Tests**: Individual module testing with mocks
- **Integration Tests**: End-to-end workflow testing
- **Mock Strategies**: Test-specific signing strategies for safe testing
- **Snapshot Testing**: For complex data structures and outputs

### Security Patterns
- **Private Key Isolation**: Secure handling of sensitive cryptographic material
- **Input Validation**: Schema-based validation of all user inputs
- **Safe Defaults**: Secure-by-default configuration options
- **Audit Logging**: Comprehensive logging of all security-relevant operations

## Development Workflow Guidelines

### Adding New Features
1. **Command Structure**: Follow existing command hierarchy
2. **Strategy Implementation**: Use existing strategy patterns
3. **Error Handling**: Implement consistent error messages
4. **Testing**: Add both unit and integration tests
5. **Documentation**: Update CLI help and documentation

### Extending Signing Strategies
1. **Interface Compliance**: Implement base strategy interface
2. **Error Handling**: Handle hardware/network failures gracefully
3. **User Experience**: Consistent prompts and feedback
4. **Security**: Follow cryptographic best practices

### Adding Deployment Handlers
1. **Handler Interface**: Follow existing handler patterns
2. **Transaction Building**: Use builder patterns for complex transactions
3. **State Management**: Proper environment state updates
4. **Rollback Support**: Handle deployment failures gracefully