class GitMetadataStore {
    environment: string;
    repo: string;

    constructor(args: {environment: string, repo: string}) {
        this.environment = args.environment;
        this.repo = args.repo;
    }
}

