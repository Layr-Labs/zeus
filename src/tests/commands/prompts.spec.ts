import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

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

    describe('caching behavior', () => {
        it('should return cached custom URL on subsequent calls', async () => {
            const customUrl = 'https://cached-safe-api.example.com/api';
            
            // First call - user selects custom and enters URL
            mockInquirer.select
                .mockResolvedValueOnce('custom')
                .mockResolvedValueOnce('enter_directly');
            mockInquirer.input.mockResolvedValue(customUrl);
            
            const firstResult = await prompts.safeTxServiceUrl(1, 'https://default.com');
            expect(firstResult).toBe(customUrl);
            
            // Clear mocks to verify no new prompts on second call
            jest.clearAllMocks();
            
            // Second call - should return cached value without prompting
            const secondResult = await prompts.safeTxServiceUrl(1, 'https://default.com');
            expect(secondResult).toBe(customUrl);
            expect(mockInquirer.select).not.toHaveBeenCalled();
        });

        it('should return default URL from cache on subsequent calls', async () => {
            const defaultUrl = 'https://default-safe-api.example.com/api';
            
            // First call - user selects default
            mockInquirer.select.mockResolvedValue('default');
            
            const firstResult = await prompts.safeTxServiceUrl(1, defaultUrl);
            expect(firstResult).toBe(defaultUrl);
            
            // Clear mocks to verify no new prompts on second call
            jest.clearAllMocks();
            
            // Second call - should return cached default choice
            const secondResult = await prompts.safeTxServiceUrl(1, defaultUrl);
            expect(secondResult).toBe(defaultUrl);
            expect(mockInquirer.select).not.toHaveBeenCalled();
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

    it('should handle text input with reuseKey and cache the result', async () => {
        mockInquirer.select.mockResolvedValue('enter_directly');
        mockInquirer.input.mockResolvedValue('cached-value');

        const result = await prompts.envVarOrPrompt({
            title: 'Enter value',
            directEntryInputType: 'text',
            isValid: (text) => text.length > 0,
            reuseKey: 'testCacheKey'
        });

        expect(result).toBe('cached-value');
        expect(mockInquirer.input).toHaveBeenCalledWith({
            message: 'Enter value',
            validate: expect.any(Function)
        });
    });

    it('should cache environment variable value when reuseKey is provided', async () => {
        process.env.CACHED_VAR = 'env-cached-value';

        mockInquirer.select.mockResolvedValue('env_var');
        mockInquirer.search.mockResolvedValue('CACHED_VAR');

        const result = await prompts.envVarOrPrompt({
            title: 'Select value',
            directEntryInputType: 'text',
            isValid: (text) => text === 'env-cached-value',
            reuseKey: 'envCacheKey'
        });

        expect(result).toBe('env-cached-value');

        // Clear mocks and try again with same key
        jest.clearAllMocks();

        const cachedResult = await prompts.envVarOrPrompt({
            title: 'Select value again',
            directEntryInputType: 'text',
            isValid: (text) => text === 'env-cached-value',
            reuseKey: 'envCacheKey'
        });

        expect(cachedResult).toBe('env-cached-value');
        expect(mockInquirer.select).not.toHaveBeenCalled();
    });
});

describe('safeApiKey', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prompts.__test__.clearCache();
    });

    it('should return undefined when empty string is provided', async () => {
        mockInquirer.select.mockResolvedValue('enter_directly');
        mockInquirer.input.mockResolvedValue('');

        const result = await prompts.safeApiKey(1);

        expect(result).toBeUndefined();
    });

    it('should return the API key when non-empty string is provided', async () => {
        mockInquirer.select.mockResolvedValue('enter_directly');
        mockInquirer.input.mockResolvedValue('my-api-key-123');

        const result = await prompts.safeApiKey(1);

        expect(result).toBe('my-api-key-123');
    });
});

describe('checkShouldSignGnosisMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prompts.__test__.clearCache();
    });

    it('should throw error when user declines to continue', async () => {
        mockInquirer.select.mockResolvedValue('no');

        const message = { domain: { name: 'Test' }, message: { data: 'test' } };

        await expect(prompts.checkShouldSignGnosisMessage(message))
            .rejects.toThrow('Transaction not approved. Cancelling for now.');
    });

    it('should complete successfully when user agrees to continue', async () => {
        mockInquirer.select.mockResolvedValue('yes');

        const message = { domain: { name: 'Test' }, message: { data: 'test' } };

        await expect(prompts.checkShouldSignGnosisMessage(message))
            .resolves.toBeUndefined();
    });
});

describe('pressAnyButtonToContinue', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should prompt with default message', async () => {
        mockInquirer.select.mockResolvedValue('yes');

        await prompts.pressAnyButtonToContinue();

        // The select function from utils.ts converts 'prompt' to 'message'
        expect(mockInquirer.select).toHaveBeenCalled();
    });

    it('should prompt with custom message when provided', async () => {
        mockInquirer.select.mockResolvedValue('yes');

        await prompts.pressAnyButtonToContinue('Custom message');

        // The select function from utils.ts converts 'prompt' to 'message'
        expect(mockInquirer.select).toHaveBeenCalled();
    });
});

describe('rpcUrl', () => {
    const originalFetch = global.fetch;
    
    beforeEach(() => {
        jest.clearAllMocks();
        prompts.__test__.clearCache();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should return RPC URL when chain ID matches', async () => {
        const expectedUrl = 'https://mainnet.infura.io/v3/abc123';
        const expectedChainId = 1;

        // Mock fetch to return the correct chain ID
        const mockFetch = jest.fn<typeof fetch>(() => 
            Promise.resolve({
                json: () => Promise.resolve({
                    result: '0x1' // Chain ID 1 in hex
                })
            } as any)
        );
        (global as any).fetch = mockFetch;

        mockInquirer.select.mockResolvedValue('enter_directly');
        mockInquirer.input.mockResolvedValue(expectedUrl);

        const result = await prompts.rpcUrl(expectedChainId);

        expect(result).toBe(expectedUrl);
        expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('eth_chainId')
        }));
    });

    it('should retry when chain ID does not match', async () => {
        const wrongUrl = 'https://goerli.infura.io/v3/abc123';
        const correctUrl = 'https://mainnet.infura.io/v3/abc123';
        const expectedChainId = 1;

        // Mock fetch to return wrong chain ID first, then correct one
        const mockFetch = jest.fn<typeof fetch>()
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve({ result: '0x5' }) // Chain ID 5 (Goerli) in hex
            } as any))
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve({ result: '0x1' }) // Chain ID 1 (Mainnet) in hex
            } as any));
        (global as any).fetch = mockFetch;

        // First call gets wrong chain, second call gets correct chain
        mockInquirer.select
            .mockResolvedValueOnce('enter_directly')
            .mockResolvedValueOnce('enter_directly');
        mockInquirer.input
            .mockResolvedValueOnce(wrongUrl)
            .mockResolvedValueOnce(correctUrl);

        const result = await prompts.rpcUrl(expectedChainId);

        expect(result).toBe(correctUrl);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockInquirer.input).toHaveBeenCalledTimes(2);
    });

    it('should cache correct RPC URL for reuse', async () => {
        const correctUrl = 'https://mainnet.infura.io/v3/abc123';
        const expectedChainId = 1;

        const mockFetch = jest.fn<typeof fetch>(() =>
            Promise.resolve({
                json: () => Promise.resolve({ result: '0x1' })
            } as any)
        );
        (global as any).fetch = mockFetch;

        mockInquirer.select.mockResolvedValue('enter_directly');
        mockInquirer.input.mockResolvedValue(correctUrl);

        // First call - sets cache
        const firstResult = await prompts.rpcUrl(expectedChainId);
        expect(firstResult).toBe(correctUrl);
        expect(mockInquirer.input).toHaveBeenCalledTimes(1);

        // Clear mocks to verify no new prompts
        jest.clearAllMocks();

        // Second call - should use cached value
        const secondResult = await prompts.rpcUrl(expectedChainId);
        expect(secondResult).toBe(correctUrl);
        expect(mockInquirer.select).not.toHaveBeenCalled();
        expect(mockInquirer.input).not.toHaveBeenCalled();
    });

    it('should NOT cache wrong chain URL and should cache correct URL after retry', async () => {
        const wrongUrl = 'https://mainnet-ethereum.infura.io/v3/wrong';
        const correctUrl = 'https://sepolia.infura.io/v3/correct';
        const expectedChainId = 11155111; // Sepolia

        // Mock fetch to return wrong chain ID first (Ethereum), then correct one (Sepolia)
        const mockFetch = jest.fn<typeof fetch>()
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve({ result: '0x1' }) // Chain ID 1 (Ethereum) in hex
            } as any))
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve({ result: '0xaa36a7' }) // Chain ID 11155111 (Sepolia) in hex
            } as any));
        (global as any).fetch = mockFetch;

        // User enters wrong URL, then correct URL
        mockInquirer.select
            .mockResolvedValueOnce('enter_directly')
            .mockResolvedValueOnce('enter_directly');
        mockInquirer.input
            .mockResolvedValueOnce(wrongUrl)
            .mockResolvedValueOnce(correctUrl);

        const firstResult = await prompts.rpcUrl(expectedChainId);

        expect(firstResult).toBe(correctUrl);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockInquirer.input).toHaveBeenCalledTimes(2);

        // Clear mocks
        jest.clearAllMocks();

        // Mock fetch for cached call
        const mockFetch2 = jest.fn<typeof fetch>(() =>
            Promise.resolve({
                json: () => Promise.resolve({ result: '0xaa36a7' }) // Sepolia
            } as any)
        );
        (global as any).fetch = mockFetch2;

        // Second call - should use cached CORRECT URL, not prompt again
        const secondResult = await prompts.rpcUrl(expectedChainId);
        expect(secondResult).toBe(correctUrl);
        expect(mockInquirer.select).not.toHaveBeenCalled();
        expect(mockInquirer.input).not.toHaveBeenCalled();
        // Should still validate the cached URL
        expect(mockFetch2).toHaveBeenCalledTimes(1);
    });

    it('should clear cache when wrong chain is detected and re-prompt', async () => {
        const wrongUrl1 = 'https://mainnet.infura.io/v3/wrong1';
        const wrongUrl2 = 'https://goerli.infura.io/v3/wrong2';
        const correctUrl = 'https://sepolia.infura.io/v3/correct';
        const expectedChainId = 11155111; // Sepolia

        // Mock fetch to return wrong chain IDs, then correct one
        const mockFetch = jest.fn<typeof fetch>()
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve({ result: '0x1' }) // Ethereum
            } as any))
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve({ result: '0x5' }) // Goerli
            } as any))
            .mockImplementationOnce(() => Promise.resolve({
                json: () => Promise.resolve({ result: '0xaa36a7' }) // Sepolia
            } as any));
        (global as any).fetch = mockFetch;

        // User enters multiple wrong URLs, then correct URL
        mockInquirer.select
            .mockResolvedValueOnce('enter_directly')
            .mockResolvedValueOnce('enter_directly')
            .mockResolvedValueOnce('enter_directly');
        mockInquirer.input
            .mockResolvedValueOnce(wrongUrl1)
            .mockResolvedValueOnce(wrongUrl2)
            .mockResolvedValueOnce(correctUrl);

        const result = await prompts.rpcUrl(expectedChainId);

        expect(result).toBe(correctUrl);
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(mockInquirer.input).toHaveBeenCalledTimes(3);
    });

    it('should use environment variable for RPC URL', async () => {
        const envUrl = 'https://env-rpc.example.com';
        process.env.RPC_URL = envUrl;
        const expectedChainId = 1;

        const mockFetch = jest.fn<typeof fetch>(() =>
            Promise.resolve({
                json: () => Promise.resolve({ result: '0x1' })
            } as any)
        );
        (global as any).fetch = mockFetch;

        mockInquirer.select.mockResolvedValue('env_var');
        mockInquirer.search.mockResolvedValue('RPC_URL');

        const result = await prompts.rpcUrl(expectedChainId);

        expect(result).toBe(envUrl);
        expect(mockInquirer.search).toHaveBeenCalledWith({
            message: 'Enter a node url',
            source: expect.any(Function),
            validate: expect.any(Function)
        });

        delete process.env.RPC_URL;
    });
});
