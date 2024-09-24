
export interface Environment {
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