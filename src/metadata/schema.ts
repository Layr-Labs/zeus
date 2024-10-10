export type TDeployManifest = {
    
    inProgressDeploy?: string;

}

export type TUpgrade = {
    name: string;
    fromSemver: string;
    to: string;
}

export type TUpgradeManifest = {
    upgrades: TUpgrade[];
}

export interface TEnvironmentManifest {
    id: string;                                 // "testnet"

    /**
     * The envirnoment that this environment promotes to.
     */
    precedes: string;                           // "mainnet"

    /**
     * important contract addresses for thie environment
     */
    contractAddresses: Record<string, string>;      

    /**
     * {@link SigningStrategy.id} that this environment requires.
     */
    signingStrategy: string;       
    
    /**
     * Latest commit of your repo deployed in this environment.
     */
    latestDeployedCommit: string;
}