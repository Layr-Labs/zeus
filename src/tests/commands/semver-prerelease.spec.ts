import { describe, it, expect } from '@jest/globals';
import semver from 'semver';

describe('semver prerelease handling with includePrerelease option', () => {
  describe('semver.satisfies with includePrerelease: true', () => {
    it('should match prerelease versions with >= ranges', () => {
      // The exact case from the user's issue
      expect(semver.satisfies('1.7.0-rc.0', '>=1.3.0', { includePrerelease: true })).toBe(true);
      
      // Additional test cases
      expect(semver.satisfies('2.0.0-alpha.1', '>=1.0.0', { includePrerelease: true })).toBe(true);
      expect(semver.satisfies('1.0.0-beta.1', '>=0.9.0', { includePrerelease: true })).toBe(true);
    });

    it('should match prerelease versions with >= ranges', () => {
      // The exact case from the user's issue
      expect(semver.satisfies('1.7.0-rc.3', '>=1.6.0 <1.8.0', { includePrerelease: true })).toBe(true);
    });

    it('should not match prerelease versions with >= ranges without includePrerelease', () => {
      // Without the option, prereleases are excluded
      expect(semver.satisfies('1.7.0-rc.0', '>=1.3.0')).toBe(false);
      expect(semver.satisfies('2.0.0-alpha.1', '>=1.0.0')).toBe(false);
      expect(semver.satisfies('1.0.0-beta.1', '>=0.9.0')).toBe(false);
    });

    it('should work with caret ranges and prereleases', () => {
      expect(semver.satisfies('1.2.3-alpha.1', '^1.2.0', { includePrerelease: true })).toBe(true);
      expect(semver.satisfies('2.0.0-rc.1', '^2.0.0-0', { includePrerelease: true })).toBe(true);
      expect(semver.satisfies('1.5.0-beta.2', '^1.0.0', { includePrerelease: true })).toBe(true);
      
      // Without includePrerelease
      expect(semver.satisfies('1.2.3-alpha.1', '^1.2.0')).toBe(false);
    });

    it('should work with tilde ranges and prereleases', () => {
      expect(semver.satisfies('1.2.3-alpha.1', '~1.2.0', { includePrerelease: true })).toBe(true);
      expect(semver.satisfies('1.2.0-rc.1', '~1.2.0-0', { includePrerelease: true })).toBe(true);
      
      // Without includePrerelease
      expect(semver.satisfies('1.2.3-alpha.1', '~1.2.0')).toBe(false);
    });

    it('should respect version boundaries even with includePrerelease', () => {
      // Prerelease should still respect version boundaries
      expect(semver.satisfies('1.0.0-alpha.1', '>=2.0.0', { includePrerelease: true })).toBe(false);
      expect(semver.satisfies('0.9.0-rc.1', '^1.0.0', { includePrerelease: true })).toBe(false);
    });

    it('should handle complex prerelease identifiers', () => {
      expect(semver.satisfies('1.0.0-alpha.beta', '>=1.0.0-alpha', { includePrerelease: true })).toBe(true);
      expect(semver.satisfies('1.0.0-rc.1.2.3', '>=1.0.0-beta', { includePrerelease: true })).toBe(true);
      expect(semver.satisfies('2.0.0-20230101.1', '>=1.5.0', { includePrerelease: true })).toBe(true);
    });

    it('should match exact prerelease versions', () => {
      expect(semver.satisfies('1.0.0-alpha.1', '1.0.0-alpha.1', { includePrerelease: true })).toBe(true);
      expect(semver.satisfies('1.0.0-alpha.1', '1.0.0-alpha.2', { includePrerelease: true })).toBe(false);
    });

    it('should handle wildcards with prereleases', () => {
      expect(semver.satisfies('1.2.3-alpha', '*', { includePrerelease: true })).toBe(true);
      expect(semver.satisfies('0.0.1-beta', '*', { includePrerelease: true })).toBe(true);
      
      // Without includePrerelease, * doesn't match prereleases
      expect(semver.satisfies('1.2.3-alpha', '*')).toBe(false);
    });
  });

  describe('edge cases and special scenarios', () => {
    it('should handle -0 suffix for including prereleases in ranges', () => {
      // Using -0 suffix is another way to include prereleases
      expect(semver.satisfies('1.0.0-rc.1', '>=1.0.0-0')).toBe(true);
      expect(semver.satisfies('2.0.0-alpha', '>=2.0.0-0')).toBe(true);
    });

    it('should differentiate between includePrerelease option and -0 suffix', () => {
      // With -0 suffix, prereleases of that version are included
      expect(semver.satisfies('1.0.0-rc.1', '>=1.0.0-0')).toBe(true);
      // Prereleases of higher versions are not included without includePrerelease
      expect(semver.satisfies('2.0.0-rc.1', '>=1.0.0-0')).toBe(false);
      
      // With includePrerelease, all prereleases in range are included
      expect(semver.satisfies('1.5.0-beta', '>=1.0.0', { includePrerelease: true })).toBe(true);
      expect(semver.satisfies('2.0.0-rc.1', '>=1.0.0', { includePrerelease: true })).toBe(true);
    });
  });
}); 