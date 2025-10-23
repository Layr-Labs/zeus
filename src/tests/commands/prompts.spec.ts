import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the external prompts library
jest.unstable_mockModule('@inquirer/prompts', () => ({
    select: jest.fn(),
    input: jest.fn(),
    password: jest.fn(),
    search: jest.fn()
}));

const mockInquirer = await import('@inquirer/prompts') as any;
const prompts = await import('../../commands/prompts');

describe('safeTxServiceUrl', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear the internal cache using test utilities
        prompts.__test__.clearCache();
        // Clear environment variables
        delete process.env.SAFE_TX_SERVICE_URL;
    });

    describe('when user selects Default', () => {
        it('should return the provided default URL when available', async () => {
            const defaultUrl = 'https://transaction-holesky.holesky-safe.protofire.io/api';
            
            // Mock select to return 'default'
            mockInquirer.select.mockResolvedValue('default');
            
            const result = await prompts.safeTxServiceUrl(17000, defaultUrl);
            
            expect(result).toBe(defaultUrl);
            expect(mockInquirer.select).toHaveBeenCalledWith({
                message: "What Safe URL would you like to use?",
                choices: [
                    {
                        name: 'Default',
                        value: 'default',
                        description: `Use default Safe API (${defaultUrl})`
                    },
                    {
                        name: 'Custom',
                        value: 'custom',
                        description: 'Use a custom Safe API URL'
                    }
                ]
            });
        });

        it('should return undefined when no default URL is provided', async () => {
            // Mock select to return 'default'
            mockInquirer.select.mockResolvedValue('default');
            
            const result = await prompts.safeTxServiceUrl(1, undefined);
            
            expect(result).toBe(undefined);
            expect(mockInquirer.select).toHaveBeenCalledWith({
                message: "What Safe URL would you like to use?",
                choices: [
                    {
                        name: 'Default',
                        value: 'default',
                        description: 'Use default Safe API'
                    },
                    {
                        name: 'Custom',
                        value: 'custom',
                        description: 'Use a custom Safe API URL'
                    }
                ]
            });
        });
    });

    describe('when user selects Custom', () => {
        beforeEach(() => {
            // Mock select to return 'custom'
            mockInquirer.select.mockResolvedValue('custom');
        });

        it('should prompt for custom URL via direct entry', async () => {
            const customUrl = 'https://custom-safe-api.example.com/api';
            
            // First mock for env var or direct entry selection
            mockInquirer.select
                .mockResolvedValueOnce('custom') // safeTxServiceUrl prompt
                .mockResolvedValueOnce('enter_directly'); // envVarOrPrompt selection
            
            // Mock direct input
            mockInquirer.input.mockResolvedValue(customUrl);
            
            const result = await prompts.safeTxServiceUrl(1, undefined);
            
            expect(result).toBe(customUrl);
            expect(mockInquirer.input).toHaveBeenCalledWith({
                message: 'Enter custom Safe API URL for Ethereum',
                validate: expect.any(Function)
            });
        });

        it('should prompt for custom URL via environment variable', async () => {
            const customUrl = 'https://env-safe-api.example.com/api';
            process.env.SAFE_TX_SERVICE_URL = customUrl;
            
            // Mock selections
            mockInquirer.select
                .mockResolvedValueOnce('custom') // safeTxServiceUrl prompt
                .mockResolvedValueOnce('env_var'); // envVarOrPrompt selection
            
            // Mock env var search
            mockInquirer.search.mockResolvedValue('SAFE_TX_SERVICE_URL');
            
            const result = await prompts.safeTxServiceUrl(1, undefined);
            
            expect(result).toBe(customUrl);
            expect(mockInquirer.search).toHaveBeenCalledWith({
                message: 'Choose an environment variable with a Safe API URL',
                source: expect.any(Function),
                validate: expect.any(Function)
            });
        });

        it('should validate URL format when entering directly', async () => {
            // Mock selections
            mockInquirer.select
                .mockResolvedValueOnce('custom')
                .mockResolvedValueOnce('enter_directly');
            
            // Mock input with validation function capture
            let validateFn: ((text: string) => boolean) | undefined;
            mockInquirer.input.mockImplementation((config: any) => {
                validateFn = config.validate;
                return Promise.resolve('https://valid-url.com/api');
            });
            
            await prompts.safeTxServiceUrl(1, undefined);
            
            expect(validateFn).toBeDefined();
            if (validateFn) {
                // Test valid URLs
                expect(validateFn('https://example.com/api')).toBe(true);
                expect(validateFn('http://localhost:8000')).toBe(true);
                
                // Test invalid URLs
                expect(validateFn('not-a-url')).toBe(false);
                expect(validateFn('')).toBe(false);
                expect(validateFn('ftp://example.com')).toBe(true); // URL constructor allows ftp
                
                // Test env var references
                process.env.TEST_URL = 'https://test.com';
                expect(validateFn('$TEST_URL')).toBe(true);
                delete process.env.TEST_URL;
                expect(validateFn('$TEST_URL')).toBe(false);
            }
        });
    });

    describe('chainIdName helper', () => {
        it('should return chain name for known chain IDs', () => {
            expect(prompts.chainIdName(1)).toBe('Ethereum');
            expect(prompts.chainIdName(5)).toBe('Goerli');
            expect(prompts.chainIdName(11155111)).toBe('Sepolia');
        });

        it('should return chains/[id] for unknown chain IDs', () => {
            expect(prompts.chainIdName(999999)).toBe('chains/999999');
            expect(prompts.chainIdName(0)).toBe('chains/0');
        });
    });
});

describe('envVarOrPrompt', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear the internal cache using test utilities
        prompts.__test__.clearCache();
        delete process.env.TEST_VAR;
    });

    it('should return cached value when reuseKey is provided and value exists', async () => {
        const firstResult = await prompts.envVarOrPrompt({
            title: 'Test prompt',
            directEntryInputType: 'text',
            isValid: (text) => text.length > 0,
            reuseKey: 'testKey'
        });

        // Mock shouldn't be called on second invocation with same key
        jest.clearAllMocks();
        
        const secondResult = await prompts.envVarOrPrompt({
            title: 'Different prompt',
            directEntryInputType: 'text',
            isValid: (text) => text.length > 0,
            reuseKey: 'testKey'
        });

        expect(secondResult).toBe(firstResult);
        expect(mockInquirer.select).not.toHaveBeenCalled();
    });

    it('should allow environment variable selection', async () => {
        process.env.TEST_VAR = 'test-value';
        
        mockInquirer.select.mockResolvedValue('env_var');
        mockInquirer.search.mockResolvedValue('TEST_VAR');
        
        const result = await prompts.envVarOrPrompt({
            title: 'Test',
            directEntryInputType: 'text',
            isValid: (text) => text === 'test-value'
        });
        
        expect(result).toBe('test-value');
    });

    it('should handle password input type', async () => {
        mockInquirer.select.mockResolvedValue('enter_directly');
        mockInquirer.password.mockResolvedValue('secret123');
        
        const result = await prompts.envVarOrPrompt({
            title: 'Enter password',
            directEntryInputType: 'password',
            isValid: (text) => text.length > 5
        });
        
        expect(result).toBe('secret123');
        expect(mockInquirer.password).toHaveBeenCalledWith({
            message: 'Enter password',
            validate: expect.any(Function),
            mask: '*'
        });
    });

    it('should throw error when reuseKey is used with password type', async () => {
        mockInquirer.select.mockResolvedValue('enter_directly');
        
        await expect(prompts.envVarOrPrompt({
            title: 'Enter password',
            directEntryInputType: 'password',
            isValid: (text) => text.length > 5,
            reuseKey: 'passwordKey'
        })).rejects.toThrow('Reuse key not supported for passwords');
    });
});
