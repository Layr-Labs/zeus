import { MetadataStore } from "../metadata/metadataStore"
import { TEnvironmentManifest, TUpgrade } from "../metadata/schema"

export const envTestnet: TEnvironmentManifest = {
  id: 'testnet',
  chainId: 1,
  deployedVersion: '0.0.1',
  contracts: {static: {}, instances: []},
  latestDeployedCommit: '0'
}

export const upgradeOne: TUpgrade = {
  name: "upgrade one",
  from: '',
  to: '',
  phases: [],
  commit: '0x'
} 

export const upgradeTwo: TUpgrade = {
  name: "upgrade two",
  from: '',
  to: '',
  phases: [],
  commit: '0x'
} 

export const mockUser = (meta: MetadataStore) => {
    return {
        zeusHostOwner: 'tester-labs',
        zeusHostRepo: 'invalid%./repo',
        login: async () => {},
        metadataStore: meta,
        loggedOutMetadataStore: meta,
        github: undefined
    }
}