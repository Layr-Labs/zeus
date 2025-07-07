import { describe, it, expect } from '@jest/globals';
import { findUpgradePaths } from '../../../commands/upgrade/utils';
import { TUpgrade } from '../../../metadata/schema';

describe('upgrade utils', () => {
  describe('findUpgradePaths with prerelease versions', () => {
    const createUpgrade = (name: string, from: string, to: string): TUpgrade => ({
      name,
      from,
      to,
      phases: [],
      commit: '0x123'
    });

    it('should find upgrade paths from release candidate to stable version', () => {
      const upgrades: TUpgrade[] = [
        createUpgrade('rc-to-stable', '1.7.0-rc.0', '1.7.0'),
        createUpgrade('stable-to-next', '1.7.0', '1.7.1'),
      ];

      const paths = findUpgradePaths('1.7.0-rc.0', '1.7.1', upgrades);
      expect(paths).toBeDefined();
      expect(paths?.length).toBe(1);
      expect(paths?.[0]).toEqual(['rc-to-stable', 'stable-to-next']);
    });

    it('should match prerelease versions with >=X.Y.Z ranges', () => {
      const upgrades: TUpgrade[] = [
        createUpgrade('redistribution', '>=1.3.0', '1.7.1'),
      ];

      // This should work now with includePrerelease: true
      const paths = findUpgradePaths('1.7.0-rc.0', '1.7.1', upgrades);
      expect(paths).toBeDefined();
      expect(paths?.length).toBe(1);
      expect(paths?.[0]).toEqual(['redistribution']);
    });

    it('should handle complex prerelease version chains', () => {
      const upgrades: TUpgrade[] = [
        createUpgrade('alpha-to-beta', '1.5.0-alpha.1', '1.5.0-beta.1'),
        createUpgrade('beta-to-rc', '1.5.0-beta.1', '1.5.0-rc.1'),
        createUpgrade('rc-to-stable', '1.5.0-rc.1', '1.5.0'),
        createUpgrade('patch-update', '1.5.0', '1.5.1'),
      ];

      const paths = findUpgradePaths('1.5.0-alpha.1', '1.5.1', upgrades);
      expect(paths).toBeDefined();
      expect(paths?.length).toBe(1);
      expect(paths?.[0]).toEqual(['alpha-to-beta', 'beta-to-rc', 'rc-to-stable', 'patch-update']);
    });

    it('should match prerelease versions with caret ranges', () => {
      const upgrades: TUpgrade[] = [
        createUpgrade('major-upgrade', '^1.0.0', '2.0.0'),
      ];

      const paths = findUpgradePaths('1.5.0-rc.2', '2.0.0', upgrades);
      expect(paths).toBeDefined();
      expect(paths?.length).toBe(1);
      expect(paths?.[0]).toEqual(['major-upgrade']);
    });

    it('should match prerelease versions with tilde ranges', () => {
      const upgrades: TUpgrade[] = [
        createUpgrade('patch-upgrade', '~1.5.0-0', '1.5.10'),
      ];

      const paths = findUpgradePaths('1.5.0-rc.1', '1.5.10', upgrades);
      expect(paths).toBeDefined();
      expect(paths?.length).toBe(1);
      expect(paths?.[0]).toEqual(['patch-upgrade']);
    });

    it('should handle multiple paths with prereleases', () => {
      const upgrades: TUpgrade[] = [
        // Path 1: Direct upgrade
        createUpgrade('direct', '>=1.0.0-0', '2.0.0'),
        // Path 2: Step by step
        createUpgrade('to-stable', '1.0.0-rc.1', '1.0.0'),
        createUpgrade('major-bump', '1.0.0', '2.0.0'),
      ];

      const paths = findUpgradePaths('1.0.0-rc.1', '2.0.0', upgrades);
      expect(paths).toBeDefined();
      // With includePrerelease, it might find additional paths
      expect(paths?.length).toBeGreaterThanOrEqual(2);
      // Should find both expected paths
      const pathNames = paths?.map(p => p.join(','));
      expect(pathNames).toContain('direct');
      expect(pathNames).toContain('to-stable,major-bump');
    });

    it('should not find paths when prerelease does not match', () => {
      const upgrades: TUpgrade[] = [
        createUpgrade('specific-prerelease', '1.0.0-alpha.1', '1.0.0'),
      ];

      // Different prerelease should not match
      const paths = findUpgradePaths('1.0.0-beta.1', '1.0.0', upgrades);
      expect(paths).toBeDefined();
      expect(paths?.length).toBe(0);
    });
  });
}); 