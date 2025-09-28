# Task Completion Checklist for Zeus

## When a coding task is completed, run these commands in order:

### 1. Code Quality Checks
```bash
npm run lint
```
- Runs ESLint on all TypeScript source files
- Must pass with no errors before proceeding
- Use `npm run lint-fix` for automatic fixes if needed

### 2. Build Verification
```bash
npm run build
```
- Compiles TypeScript to ensure no compilation errors
- Verifies all imports and type definitions are correct
- Must complete successfully

### 3. Test Suite
```bash
npm test
```
- Runs full test suite with coverage
- All tests must pass
- Includes both unit tests and integration tests
- Tests run in band (sequentially) for reliability

### 4. Integration Testing (if applicable)
If changes affect CLI commands or core functionality:
```bash
# Test specific upgrade scripts
zeus test --env <test-env> ./path/to/script.s.sol

# Test deployment workflows
zeus deploy run --upgrade <test-upgrade> --env <test-env>
```

## Additional Verification Steps

### For Production Builds
```bash
npm run build-prod
```
- Creates optimized webpack bundle
- Includes documentation site build
- Required before publishing

### For Documentation Changes
```bash
npm run build-site
```
- Builds the documentation site
- Verify documentation renders correctly

## Pre-commit Checklist
- [ ] All linting passes (`npm run lint`)
- [ ] All tests pass (`npm test`)  
- [ ] Code builds successfully (`npm run build`)
- [ ] New functionality has corresponding tests
- [ ] Documentation updated if needed
- [ ] Breaking changes documented in PR description
- [ ] Follows TypeScript strict mode conventions
- [ ] No unused variables (except those prefixed with `_`)

## Integration Testing Notes
- Zeus integrates with external tools (Forge, GitHub, blockchain networks)
- Test with actual environments when possible
- Verify multisig integrations work correctly
- Check Ledger hardware wallet compatibility if signing logic is modified
- Validate deployment artifact generation and metadata storage