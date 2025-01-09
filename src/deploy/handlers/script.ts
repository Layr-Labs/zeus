import { join } from "path";
import { SavebleDocument, Transaction } from "../../metadata/metadataStore";
import { ArgumentValidFn, TArtifactScriptRun, TDeploy } from "../../metadata/schema";
import { HaltDeployError, TStrategyOptions } from "../../signing/strategy";
import { existsSync } from "fs";
import { injectableEnvForEnvironment } from "../../commands/run";
import { envVarOrPrompt } from "../../commands/prompts";
import { execSync } from "child_process";
import { canonicalPaths } from "../../metadata/paths";
import { advance } from "../../commands/deploy/cmd/utils";
import { PhaseTypeHandler } from "./base";

interface ExecSyncError {
    pid: number,
    stdout: string,
    stderr: string,
    status: number,
    signal: string,
}

export async function executeScriptPhase(deploy: SavebleDocument<TDeploy>, metatxn: Transaction, _options: TStrategyOptions): Promise<void> {
    const seg = deploy._.segments[deploy._.segmentId];
    const script = join(deploy._.upgradePath, seg.filename);   
    if (!existsSync(script)) {
        console.error(`Script ${script} does not exist. Make sure your local copy is OK before proceeding.`);
        throw new HaltDeployError(deploy, `Script ${script} does not exist.`);
    }

    console.log(`Running ${script}...`);
    const env = await injectableEnvForEnvironment(metatxn, deploy._.env, deploy._.name);

    // fetch additional arguments.
    const cliArgs: Record<string, string> = {};
    const envArgs: Record<string, string> = {};

    for (const arg of (seg.arguments ?? [])) {
        const argValue = await envVarOrPrompt({
            title: arg.prompt,
            directEntryInputType: arg.inputType ?? 'text',
            isValid: ArgumentValidFn[arg.type]
        });
        if (arg.passBy === 'env') {
            envArgs[arg.name] = argValue;
        } else {
            cliArgs[arg.name] = argValue;
        }
    }

    const cliArgString = Object.keys(cliArgs).map(key => `--${key} "${cliArgs[key]}"`).join(' ');
    const scriptRun: TArtifactScriptRun = (() => {
        try {
            const res = execSync(`${script} ${cliArgString}`, {stdio: 'inherit', env: {...process.env, ...env, ...envArgs}})?.toString();
            return {
                success: true,
                exitCode: 0,
                stdout: res,
                stderr: '',
                date: new Date().toString()
            };
        } catch (e) {
            const err = e as ExecSyncError;
            console.error(err);
            return {
                success: false,
                exitCode: err.status,
                stdout: err.stdout,
                stderr: err.stderr,
                date: new Date().toString()
            };
        }
    })();

    const savedRun = await metatxn.getJSONFile(canonicalPaths.scriptRun({
        deployEnv: deploy._.env,
        deployName: deploy._.name,
        segmentId: deploy._.segmentId,
    }))
    savedRun._ = scriptRun;
    await savedRun.save();

    if (scriptRun.success) {
        console.log(`Successfully ran ${script}.`);
        advance(deploy);
        await deploy.save();
        await metatxn.commit(`[pass] Ran script ${script} for deploy.`);
        return
    } else {
        console.error(`${script} failed. Re-run with resume to try again.`);
        await deploy.save();
        await metatxn.commit(`[fail] Ran script ${script} for deploy.`);
        throw new HaltDeployError(deploy, `Script ${script} failed.`);
    }
}

const handler: PhaseTypeHandler = {
    execute: executeScriptPhase,
    cancel: undefined, /* script phase scan be cancelled immediately, as they have either run or they haven't */
}

export default handler;