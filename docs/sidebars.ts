import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      link: {
        type: 'doc',
        id: 'getting-started/index',
      },
      items: [
        'getting-started/index',
      ],
    },
    {
      type: 'category',
      label: 'Migrations',
      items: [
        'migrations/first-migration',
        'migrations/running-deployments',
        'migrations/common-pitfalls',
      ],
    },
    {
      type: 'category',
      label: 'Environments',
      items: [
        'environments/overview',
        'environments/configuration',
        'environments/best-practices',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Topics',
      items: [
        'advanced/verification',
        'advanced/patterns',
        'advanced/multi-org',
      ],
    },
  ],
};

export default sidebars;
