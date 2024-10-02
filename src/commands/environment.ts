import { Octokit } from "octokit";

export class Enviornment {
    name: string
    github: Octokit

    constructor(github: Octokit, name: string) {
        this.name = name;
        this.github = github;
    }
}