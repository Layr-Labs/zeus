# Zeus Web Signing Interface

This directory contains the web interface used for Safe transaction signing. The interface is built in React and is used by the WebGnosisSigningStrategy to present a signing UI to users.

## Functionality

- Displays transaction details in a user-friendly format
- Supports various wallet connections (MetaMask, WalletConnect, etc.)
- Provides both parsed and raw message views
- Validates that the connected wallet is authorized to sign
- Simulates transactions via Tenderly before signing
- Securely passes signatures back to the CLI

## Development

To develop the web interface:

```bash
# From the site directory
npm install
npm run dev
```

## Building

The site is automatically built during the package build process. The build artifacts are copied to `dist/site-dist` in the main package, which ensures they're included when the package is published to npm.

```bash
# From the root directory
npm run build-site
```

## Distribution

When the Zeus package is installed, the WebGnosisSigningStrategy will look for the web interface files in the `dist/site-dist` directory relative to the strategy's location.

## Styling

The interface uses CSS for styling with a focus on clarity and usability. The styles are defined in App.css and are designed to work well on various screen sizes.