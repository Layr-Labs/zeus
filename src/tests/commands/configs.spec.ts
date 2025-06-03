import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';

const mockRepoRoot = '/fake/repo/root';

// Create mock functions
const mockExistsSync = jest.fn<(s: string) => boolean>();
const mockExecSync = jest.fn<(s: string, o?: any) => Buffer | string>();

jest.unstable_mockModule('fs', () => ({
  ...fs,
  existsSync: mockExistsSync,
  default: {
    ...fs,
    existsSync: mockExistsSync
  }
}));
jest.unstable_mockModule('child_process', () => ({
  execSync: mockExecSync,
  default: { execSync: mockExecSync }
}));

const { findClosestZeusFile } = await import('../../commands/configs');

describe('findClosestZeusFile', () => {
  const rootZeusFile = path.join(mockRepoRoot, '.zeus');
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock execSync to return fake repo root when getting git root
    mockExecSync.mockImplementation((command: string) => {
      if (command === 'git rev-parse --show-toplevel') {
        return Buffer.from(mockRepoRoot);
      }
      // Return empty string for other commands by default
      return Buffer.from('');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return root .zeus file when it exists', () => {
    // Mock fs.existsSync to return true for the root .zeus file
    mockExistsSync.mockImplementation((filePath: string) => {
      return filePath === rootZeusFile;
    });

    const result = findClosestZeusFile();

    expect(result).toBe(rootZeusFile);
    expect(mockExistsSync).toHaveBeenCalledWith(rootZeusFile);

    // Should only call execSync once for getRepoRoot
    expect(mockExecSync).toHaveBeenCalledTimes(1);
    expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --show-toplevel');
  });

  it('should find the shallowest .zeus file in a subdirectory when root .zeus does not exist', () => {
    // Mock fs.existsSync to return false for the root .zeus file
    mockExistsSync.mockImplementation((filePath: string) => {
      return filePath !== rootZeusFile;
    });

    // Mock execSync to handle both commands
    mockExecSync.mockImplementation((command: string, options?: any) => {
      if (command === 'git rev-parse --show-toplevel') {
        return Buffer.from(mockRepoRoot);
      }
      if (command.includes('git ls-files')) {
        // Return string directly when encoding is specified
        if (options?.encoding === 'utf-8') {
          return 'subdir1/.zeus\nsubdir2/deeper/nested/.zeus\nsubdir3/another/.zeus';
        }
        return Buffer.from('subdir1/.zeus\nsubdir2/deeper/nested/.zeus\nsubdir3/another/.zeus');
      }
      return Buffer.from('');
    });

    const result = findClosestZeusFile();

    expect(result).toBe(path.join(mockRepoRoot, 'subdir1/.zeus'));
    expect(mockExistsSync).toHaveBeenCalledWith(rootZeusFile);
    expect(mockExecSync).toHaveBeenCalledWith(
      'git ls-files -co --exclude-standard "*/.zeus"',
      expect.objectContaining({ cwd: mockRepoRoot })
    );
  });

  it('should sort .zeus files by depth and return the shallowest', () => {
    // Mock fs.existsSync to return false for the root .zeus file
    mockExistsSync.mockImplementation((filePath: string) => {
      return filePath !== rootZeusFile;
    });

    // Mock execSync to return files in non-sorted order
    mockExecSync.mockImplementation((command: string, options?: any) => {
      if (command === 'git rev-parse --show-toplevel') {
        return Buffer.from(mockRepoRoot);
      }
      if (command.includes('git ls-files')) {
        // Return string directly when encoding is specified
        if (options?.encoding === 'utf-8') {
          return 'subdir2/deeper/nested/.zeus\nsubdir1/.zeus\nsubdir3/another/.zeus';
        }
        return Buffer.from('subdir2/deeper/nested/.zeus\nsubdir1/.zeus\nsubdir3/another/.zeus');
      }
      return Buffer.from('');
    });

    const result = findClosestZeusFile();

    expect(result).toBe(path.join(mockRepoRoot, 'subdir1/.zeus'));
  });

  it('should fall back to the root .zeus file when git command fails', () => {
    // Mock fs.existsSync to return false for the root .zeus file
    mockExistsSync.mockImplementation((filePath: string) => {
      return filePath !== rootZeusFile;
    });

    // Mock execSync to throw error for ls-files command
    mockExecSync.mockImplementation((command: string, options?: any) => {
      if (command === 'git rev-parse --show-toplevel') {
        return Buffer.from(mockRepoRoot);
      }
      if (command.includes('git ls-files')) {
        throw new Error('git command failed');
      }
      return Buffer.from('');
    });

    const result = findClosestZeusFile();

    expect(result).toBe(rootZeusFile);
    expect(mockExistsSync).toHaveBeenCalledWith(rootZeusFile);
    expect(mockExecSync).toHaveBeenCalledWith(
      'git ls-files -co --exclude-standard "*/.zeus"',
      expect.objectContaining({ cwd: mockRepoRoot })
    );
  });

  it('should return root .zeus file when no .zeus files are found in subdirectories', () => {
    // Mock fs.existsSync to return false for the root .zeus file
    mockExistsSync.mockImplementation((filePath: string) => {
      return filePath !== rootZeusFile;
    });

    // Mock execSync to return empty string for ls-files
    mockExecSync.mockImplementation((command: string, options?: any) => {
      if (command === 'git rev-parse --show-toplevel') {
        return Buffer.from(mockRepoRoot);
      }
      if (options?.encoding === 'utf-8') {
        return '';
      }
      return Buffer.from('');
    });

    const result = findClosestZeusFile();

    expect(result).toBe(rootZeusFile);
    expect(mockExistsSync).toHaveBeenCalledWith(rootZeusFile);
    expect(mockExecSync).toHaveBeenCalled();
  });
});
