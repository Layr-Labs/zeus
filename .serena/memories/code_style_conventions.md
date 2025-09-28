# Zeus Code Style and Conventions

## TypeScript Configuration
- **Target**: ESNext with DOM library support
- **Module System**: ESNext with Bundler resolution
- **Strict Mode**: Enabled with all strict type-checking options
- **Source Maps**: Enabled for debugging
- **Experimental Decorators**: Enabled
- **JSON Module Resolution**: Enabled for importing JSON files

## ESLint Configuration
- **Base**: ESLint recommended + TypeScript ESLint strict + stylistic rules
- **Unused Variables**: Error level with underscore prefix ignore pattern
  - Variables, parameters, and caught errors starting with `_` are ignored
  - Rest siblings are ignored for destructuring
- **File Extensions**: `.ts` and `.tsx` treated as ESM

## File Organization
### Source Structure
- `src/` - Main source directory
- `src/commands/` - CLI command implementations (hierarchical structure)
- `src/signing/` - Signing strategies (EOA, Ledger, Gnosis)
- `src/deploy/` - Deployment handlers
- `src/metadata/` - Metadata management (GitHub integration)
- `src/tests/` - Test files organized by feature

### Build Output
- `dist/` - Compiled output directory
- `dist/bundle.cjs` - Main CLI executable
- `dist/site-dist` - Documentation site build

## Naming Conventions
- **Files**: kebab-case for most files, camelCase for some utilities
- **Directories**: kebab-case with feature-based organization
- **Test Files**: `*.spec.ts` suffix
- **Commands**: Hierarchical structure with `cmd/` subdirectories

## Import/Export Patterns
- ESM imports/exports throughout
- JSON imports enabled for configuration files
- Synthetic default imports allowed for CommonJS compatibility

## Documentation
- README-driven development with comprehensive user guides
- Inline code documentation expected
- Contributing guidelines emphasize clear PR descriptions and test coverage

## Testing Standards
- Jest with ts-jest for TypeScript support
- Test files in `src/tests/` with feature-based organization
- Coverage thresholds set to minimum 1% (likely placeholder values)
- ESM modules with experimental VM modules support