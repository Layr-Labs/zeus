import ora from "ora";
import { Transaction } from "../../../metadata/metadataStore";
import { canonicalPaths } from "../../../metadata/paths";
import { TDeploy, TDeployLock } from "../../../metadata/schema";
import { currentUser } from "./utils";

export const releaseDeployLock: (deploy: TDeploy, txn: Transaction) => Promise<void> = async (deploy, txn) => {
    const prompt = ora(`Releasing deploy lock...'`);
    const spinner = prompt.start();
    try {
        const deployLock = await txn.getJSONFile<TDeployLock>(canonicalPaths.deployLock(deploy));
        if (deployLock._.holder !== currentUser()) {
            spinner.stopAndPersist({prefixText: '❌'});
            console.warn(`Cannot release deploy lock for ${deploy.env} -- you do not own this lock. (got: ${deployLock._.holder}, expected: ${currentUser()})`);
            return;
        }

        deployLock._.holder = undefined;
        deployLock._.description = undefined;
        deployLock._.untilTimestampMs = undefined;
        await deployLock.save();
        spinner.stopAndPersist({prefixText: '✅'});
    } catch (e) {
        spinner.stopAndPersist({prefixText: '❌'});
        throw e;
    }
}

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

export const acquireDeployLock: (deploy: TDeploy, txn: Transaction) => Promise<boolean> = async (deploy, txn) => {
    const prompt = ora(`Acquiring deploy lock...'`);
    const spinner = prompt.start();
    try {
        const deployLock = await txn.getJSONFile<TDeployLock>(canonicalPaths.deployLock(deploy));
        const currentEmail = currentUser();

        const acquireLock = async () => {
            deployLock._.description = `Deploy ${deploy.name} - ${deploy.segmentId}/${deploy.phase}`;
            deployLock._.holder = currentEmail;
            deployLock._.untilTimestampMs = Date.now() + (5 * MINUTES);
            await deployLock.save();
            spinner.stopAndPersist({prefixText: '✅'});
            return true;
        }
        const isEmptyLock = !deployLock._.holder;
        if (isEmptyLock) {
            return await acquireLock();
        }

        const isStaleLock = deployLock._.holder && deployLock._.untilTimestampMs && (deployLock._.untilTimestampMs < Date.now());
        if (isStaleLock) {
            // lock expired.
            console.warn(`Warning: taking expired deploy lock from ${deployLock._.holder} (${deployLock._.description})`)
            console.warn(`You might clobber their deploy. Check 'zeus deploy status' for more information...`);
            return await acquireLock();
        }

        const isMyLock = deployLock._.holder === currentEmail;
        if (isMyLock) {
            // you already have the lock for this deploy. you can resume / continue as needed.
            spinner.stopAndPersist({prefixText: '✅'});
            return true;
        }

        console.error(`Deploy lock held by ${deployLock._.holder} (expires ${new Date(deployLock._.untilTimestampMs ?? 0)})`)
        spinner.stopAndPersist({prefixText: '❌'});
        return false;
    } catch (e) {
        spinner.stopAndPersist({prefixText: '❌'});
        console.error(`An error occurred acquiring the deploy lock: ${e}`);
        return false;
    }
};
