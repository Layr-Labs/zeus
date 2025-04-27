import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { TLoggedInState, TState } from '../../commands/inject';
import { MockMetadataStore } from '../mockStorage';
import { mockUser } from '../mockData';
import { Octokit } from 'octokit';
import fs from 'fs';
import { TZeusConfig, TZeusProfile } from '../../commands/configs';
import { MockConfig } from '../mockConfig';

const mockOctokit = {
  rest: {
    repos: {
      get: jest.fn<() => Promise<any>>().mockResolvedValue({ data: { name: 'test-repo' } }),
    },
  },
} as unknown as Octokit;

const mockZeusConfig = new MockConfig<TZeusConfig>({zeusHost: 'https://google.com', migrationDirectory: 'script/releases'}, '');
const mockZeusProfile = new MockConfig<TZeusProfile>({zeusHost: 'https://google.com'}, '');

jest.unstable_mockModule('../../commands/configs', () => ({
  configs: {
    zeus: mockZeusConfig,
    zeusProfile: mockZeusProfile
  },
  getRepoRoot: jest.fn().mockReturnValue('./'),
}));

jest.unstable_mockModule('../../commands/utils', () => ({
  question: jest.fn(),
}));

const metadataStore = new MockMetadataStore({});

// Mock command-specific dependencies
const ___originalInject = await import('../../commands/inject');
jest.unstable_mockModule('../../commands/inject', async () => {
  return {
    ...___originalInject,
    assertLoggedIn: jest.fn<(user: TState) => TLoggedInState>().mockImplementation((user: TState) => ({
      ...user,
      metadataStore: metadataStore,
      loggedOutMetadataStore: metadataStore,
      github: mockOctokit,
    })),
    load: jest.fn<() => Promise<TState>>().mockResolvedValue({
      zeusHostOwner: `layr-labs`,
      zeusHostRepo: `eigenlayer-contracts-zeus-metadata`,
      metadataStore: metadataStore,
      loggedOutMetadataStore: metadataStore,
      github: mockOctokit,
      login: async () => {}
    }),
    loggedIn: jest.fn(),
  }
});

const utils = await import('../../commands/utils');
const questionMock = utils.question as jest.MockedFunction<typeof utils.question>;

const cmd = await import('../../commands/init');

describe('init command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log');
    jest.spyOn(console, 'error');
    jest.spyOn(fs, 'existsSync');
    jest.spyOn(fs, 'mkdirSync');

    jest.spyOn(mockZeusConfig, 'load');
    jest.spyOn(mockZeusConfig, 'write');

    (fs.mkdirSync as jest.Mock).mockImplementation(() => {}); // disable mkdir.
    
    questionMock
      .mockResolvedValueOnce('https://github.com/test-org/test-repo') // First call: zeusHost
      .mockResolvedValueOnce('migrations'); // Second call: migrationDirectory
  });

  afterEach(() => {
    jest.restoreAllMocks();
  })

  it('should initialize a new zeus project when not already initialized', async () => {
    const mockStorage = new MockMetadataStore({});
    
    const mockUserWithGithub = {
      ...mockUser(mockStorage),
      github: mockOctokit,
    };

    (mockZeusConfig.load as jest.Mock<typeof mockZeusConfig.load>).mockResolvedValueOnce(undefined);
    (fs.existsSync as jest.Mock).mockReturnValueOnce(false); // directory doesn't exist.
    (fs.mkdirSync as jest.Mock).mockImplementationOnce(() => {}); // don't actually create the dir
    await cmd.handler(mockUserWithGithub);
    
    expect(mockZeusConfig.load).toHaveBeenCalled();
    expect(fs.existsSync).toHaveBeenCalled();
    expect(fs.mkdirSync).toHaveBeenCalledWith('migrations', { recursive: true });
    expect(mockZeusConfig.write).toHaveBeenCalledWith({
      zeusHost: 'https://github.com/test-org/test-repo',
      migrationDirectory: 'migrations',
    });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('created directory'));
  });

  it('should exit if zeus configuration already exists', async () => {
    jest.spyOn(mockZeusConfig, 'load');

    const mockStorage = new MockMetadataStore({});
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    (fs.existsSync as jest.Mock).mockReturnValueOnce(true); // not testing this.
    await cmd.handler(mockUser(mockStorage));
    
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('already has a zeus config'));
    
    processExitSpy.mockRestore();
  });

  it('should create the migrations directory if it does not exist', async () => {
    const mockStorage = new MockMetadataStore({});
    (mockZeusConfig.load as jest.Mock<typeof mockZeusConfig.load>).mockResolvedValueOnce(undefined);
    
    const mockUserWithGithub = {
      ...mockUser(mockStorage),
      github: mockOctokit,
    };

    (fs.existsSync as jest.Mock).mockReturnValue(false);
    
    await cmd.handler(mockUserWithGithub);
    
    expect(fs.mkdirSync).toHaveBeenCalledWith('migrations', { recursive: true });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('created directory'));
  });

  it('should not create the migrations directory if it already exists', async () => {
    const mockStorage = new MockMetadataStore({});
    (mockZeusConfig.load as jest.Mock<typeof mockZeusConfig.load>).mockResolvedValueOnce(undefined);
    
    const mockUserWithGithub = {
      ...mockUser(mockStorage),
      github: mockOctokit
    };

    // Mock directory already exists
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    await cmd.handler(mockUserWithGithub);
    
    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('created directory'));
  });
});