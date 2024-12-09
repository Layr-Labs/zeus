import { command } from "cmd-ts";
import { assertInRepo, inRepo, requires, TState } from "../../inject";
import chalk from "chalk";
import * as allArgs from "../../args";
import { getActiveDeploy } from "./utils";
import { EOAPhase, MultisigPhase } from "../../../metadata/schema";

async function handler(_user: TState, {env}: {env: string}) {
    const user = assertInRepo(_user);
    const metatxn = await user.metadataStore.begin();

    const deploy = await getActiveDeploy(metatxn, env);
    if (deploy) {
        console.log(`${chalk.bold(`Deploy in progress:`)} - ${deploy._.name}`)
        console.log(chalk.italic(`\tStarted: ${deploy._.startTime}\n`));

        for (let i = 0; i < deploy._.segments.length; i++) {
            const isActiveSegment = deploy._.segmentId === i;
            const isCompleteSegment = deploy._.segmentId > i;
            const wrapSegment = (() => {
                if (isActiveSegment) {
                    return chalk.bold.italic.bgAnsi256(188);
                } else if (isCompleteSegment) {
                    // see: https://www.ditig.com/publications/256-colors-cheat-sheet
                    return chalk.bgAnsi256(188).black;
                } else {
                    return chalk.black;
                }
            })()
            console.log(wrapSegment(`- [${i+1}/${deploy._.segments.length}] ${deploy._.segments[i].filename}`))
            const phases = deploy._.segments[i].type === 'eoa' ? EOAPhase : MultisigPhase;
            Object.values(phases).forEach(phase => {
                const deployPhaseIndex = Object.values(phases).indexOf(deploy._.phase);
                const currentPhaseIndex = Object.values(phases).indexOf(phase);
                const isPhaseComplete = ((currentPhaseIndex < deployPhaseIndex) && isActiveSegment) || isCompleteSegment;
                const phaseMatches = deploy._.phase === phase;
                const isActivePhase = phaseMatches && isActiveSegment;

                const textColor = (() => {
                    if (isActivePhase) { 
                        return chalk.bgBlack.white;
                    } else if (isPhaseComplete) {
                        return chalk.bgAnsi256(188).black;
                    } else {
                        return chalk.black;
                    }
                })();

                console.log(textColor(`\t- ${phase}${isActivePhase ? '                 ⬅️' : ''}`))
                if (isActivePhase) {
                    const metadata = deploy._.metadata[deploy._.segmentId];
                    if (metadata) {
                        for (const key of Object.keys(metadata)) {
                            console.log(chalk.italic(`\t\t${key} => ${(metadata as unknown as Record<string, unknown>)[key]}`))
                        }
                    } else {
                            console.log(chalk.italic(`\n\t\t<no metadata available>\n`))
                    }
                }
            });
        }
    } else {
        console.log(`No deploy in progress.`);
    }    
}

const cmd = command({
    name: 'status',
    description: '',
    version: '1.0.0',
    args: {
        env: allArgs.env,
    },
    handler: requires(handler, inRepo),
})

export default cmd;
