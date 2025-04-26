import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string; // Using Font Awesome icons instead of SVGs
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Consistent Deployments',
    icon: 'fa-solid fa-rocket',
    description: (
      <>
        Write once, deploy anywhere. Zeus upgrade scripts enable consistent 
        deployments across multiple environments like testnet and mainnet.
      </>
    ),
  },
  {
    title: 'Multisig Support',
    icon: 'fa-solid fa-key',
    description: (
      <>
        Express complex transactions for multisig execution with clear approval 
        flows and security checks. Perfect for permissioned upgrades.
      </>
    ),
  },
  {
    title: 'Deployment Lifecycle',
    icon: 'fa-solid fa-code-branch',
    description: (
      <>
        Track contract addresses, verify deployments, and maintain a 
        comprehensive history of all deployments with Zeus's built-in lifecycle management.
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <i className={`${icon} ${styles.featureIcon}`}></i>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
