import { command } from "cmd-ts";
import { inRepo, loggedIn, requires, TState } from "../../inject";
import chalk from "chalk";
import * as allArgs from "../../args";
import { getActiveDeploy } from "./utils";
import { EOAPhase, MultisigPhase } from "../../../metadata/schema";

async function handler(user: TState, {env}: {env: string}) {
    const deploy = await getActiveDeploy(user,env);
    if (deploy) {
        console.log(`${chalk.bold(`Deploy in progress:`)} - ${deploy.name}`)
        console.log(chalk.italic(`\tStarted: ${deploy.startTime}\n`));

        for (let i = 0; i < deploy.segments.length; i++) {
            const isActiveSegment = deploy.segmentId === i;
            const isCompleteSegment = deploy.segmentId > i;
            const wrapSegment = (() => {
                if (isActiveSegment) {
                    return chalk.black;
                } else if (isCompleteSegment) {
                    return chalk.bgGreen.white;
                } else {
                    return chalk.gray;
                }
            })()
            console.log(wrapSegment(`- [${i+1}/${deploy.segments.length}] ${deploy.segments[i].filename}`))
            const phases = deploy.segments[i].type === 'eoa' ? EOAPhase : MultisigPhase;
            Object.values(phases).forEach(phase => {
                const deployPhaseIndex = Object.values(phases).indexOf(deploy.phase);
                const currentPhaseIndex = Object.values(phases).indexOf(phase);
                const isPhaseComplete = ((currentPhaseIndex < deployPhaseIndex) && isActiveSegment) || isCompleteSegment;
                const phaseMatches = deploy.phase === phase;
                const isActivePhase = phaseMatches && isActiveSegment;

                const textColor = (() => {
                    if (isActivePhase) { 
                        return chalk.black;
                    } else if (isPhaseComplete) {
                        return chalk.bgGreen.white;
                    } else {
                        return chalk.gray;
                    }
                })();

                console.log(`\t- ${textColor(phase)}${isActivePhase ? '          ⬅️    (current step)' : ''}`)
                if (isActivePhase) {
                    const metadata = deploy.metadata[deploy.segmentId];
                    if (metadata) {
                        for (const key of Object.keys(metadata)) {
                            console.log(`\t\t${key} => ${(metadata as Record<string, unknown>)[key]}`)
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
    handler: requires(handler, loggedIn, inRepo),
})

export default cmd;
