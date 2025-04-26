import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <div className="row align-items-center">
          <div className="col col--7">
            <Heading as="h1" className="hero__title">
              Zeus
            </Heading>
            <p className="hero__subtitle">{siteConfig.tagline}</p>
            <div className={styles.buttons}>
              <Link
                className="button button--secondary button--lg"
                to="/getting-started">
                Get Started →
              </Link>
              <Link
                className="button button--outline button--lg button--secondary margin-left--md"
                to="https://github.com/Layr-Labs/zeus">
                GitHub
              </Link>
            </div>
          </div>
          <div className="col col--5">
            <img 
              src={useBaseUrl('img/eigenlogo.svg')}
              alt="EigenLayer Logo" 
              className={styles.heroLogo}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Zeus - Onchain Deploy Management"
      description="Zeus manages complex deploy processes for onchain software, providing consistent deployments across environments with multisig support">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <div className="container padding-vert--xl text--center">
          <Heading as="h2">Ready to streamline your blockchain deployments?</Heading>
          <p>Follow our simple setup guide to get started with Zeus for your project.</p>
          <div className={styles.buttons}>
            <Link
              className="button button--primary button--lg"
              to="/getting-started">
              Get Started
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
