import { TUpgrade } from "../../metadata/schema";
import semver from 'semver';

type TPartialRoute = {
    version: string; // current version, as of this segment.
    upgradePath: string[] // all upgradesApplied
}

type Path = string[]

/**
 * Identify the path of sequential upgrades that results in promoting an environment from "$from" to "$to" version.
 */
export function findUpgradePaths(from: string, to: string, allUpgrades: TUpgrade[]): Path[] | undefined {
    const allPaths: Path[] = [];
    const availableRoutes: TPartialRoute[] = 
        allUpgrades
            .filter(upgrade => semver.satisfies(from, upgrade.from))
            .map((upgrade) => {
                return {
                    version: upgrade.to,
                    upgradePath: [upgrade.name],
                }
            });
    while (availableRoutes.length > 0) {
        const route = availableRoutes.pop()!;
        if (route.version === to) {
            allPaths.push(route.upgradePath);
            continue;
        }

        // see what upgrades we have available.
        allUpgrades
            .filter(upgrade => semver.satisfies(route.version, upgrade.from) && !route.upgradePath.includes(upgrade.name))
            .map<TPartialRoute>(upgrade => {
                return {
                    version: upgrade.to,
                    upgradePath: [...route.upgradePath, upgrade.name]
                }
            })
            .forEach(upgradePath => availableRoutes.push(upgradePath));
    }
    return allPaths;
}