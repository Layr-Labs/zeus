import path from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync } from 'fs';

export type TZeusState = {
    accessToken: string
}

export function loadDotZeus(): TZeusState | undefined {
    try { 
        return existsSync(dotZeus()) ? JSON.parse(readFileSync(dotZeus(), {encoding: 'utf-8'})) as TZeusState : undefined;
    } catch {}
}

export function dotZeus(): string {
    return path.join(homedir(), '.zeus');
}

// get all zeus-state, from environment variables + repo.
export function load() {
    return {
        dotZeus: loadDotZeus(),
        zeusHost: process.env.ZEUS_HOST,
    }
}