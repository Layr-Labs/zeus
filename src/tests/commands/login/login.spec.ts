import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { TState } from '../../../commands/inject';
import { MockMetadataStore } from '../../mockStorage';
import { mockUser } from '../../mockData';

// Mock command-specific dependencies
const ___originalInject = await import('../../../commands/inject');
jest.unstable_mockModule('../../../commands/inject', async () => {
  return {
    ...___originalInject,
    assertInRepo: jest.fn((user) => user),
    load: jest.fn<() => Promise<TState>>().mockResolvedValue({
      zeusHostOwner: `layr-labs`,
      zeusHostRepo: `eigenlayer-contracts-zeus-metadata`,
      metadataStore: undefined,
      loggedOutMetadataStore: undefined,
      github: undefined,
      login: async () => {}
    }),
    inRepo: jest.fn(),
  }
});

const cmd = await import('../../../commands/login/login');

describe('login command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log');
    jest.spyOn(console, 'error');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  })

  it('should successfully log in a user', async () => {
    const mockStorage = new MockMetadataStore({});
    const mockLoginFn = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    
    const mockUserState = {
      ...mockUser(mockStorage),
      login: mockLoginFn
    };

    await cmd.handler(mockUserState);
    
    expect(mockLoginFn).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Happy deploying'));
  });

  it('should handle login failures', async () => {
    const mockStorage = new MockMetadataStore({});
    const mockLoginFn = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Login failed'));
    
    const mockUserState = {
      ...mockUser(mockStorage),
      login: mockLoginFn
    };

    await cmd.handler(mockUserState);
    
    expect(mockLoginFn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('failed logging in'));
  });
});