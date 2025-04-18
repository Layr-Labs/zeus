import { useEffect, useState } from 'react'
import './App.css'
import { createConfig, http } from '@wagmi/core'
import { mainnet, sepolia, goerli } from '@wagmi/core/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, useDisconnect, useAccount, useConnect, useSignTypedData, useSwitchChain } from 'wagmi'
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors'

// Using WalletConnect with a valid project ID
const WALLET_CONNECT_PROJECT_ID = '2a1cb39c11c473fcfb2a02856fe6697a'

function parseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  
  // Get the encoded EIP712 data from the typedData parameter
  const typedDataParam = params.get('typedData');
  
  // Parse the encoded typed data if it exists
  let typedData = null;
  if (typedDataParam) {
    try {
      typedData = JSON.parse(decodeURIComponent(typedDataParam));
      console.log('Parsed EIP-712 typed data:', typedData);
    } catch (err) {
      console.error('Failed to parse typed data from URL parameter:', err);
    }
  }
  
  return {
    typedData, // The parsed EIP-712 typed data object
    secret: params.get('secret'),
  };
}

// Define supported chains for our app
const supportedChains = [mainnet, sepolia, goerli] as const;

// For creating custom chain objects if needed (unused but kept for future reference)
// @ts-ignore - Intentionally unused function kept for future reference
const _createChain = (chainId: number) => {
  return {
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [`https://rpc.ankr.com/${chainId}`] },
    },
  };
};

// Helper function to get a user-friendly chain name
function getChainName(chainId: number): string {
  const knownChains: Record<number, string> = {
    1: 'Ethereum Mainnet',
    5: 'Goerli Testnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon Mainnet',
    80001: 'Polygon Mumbai',
    42161: 'Arbitrum One',
    421613: 'Arbitrum Goerli',
    10: 'Optimism',
    420: 'Optimism Goerli',
    56: 'BNB Smart Chain',
    97: 'BNB Testnet',
    43114: 'Avalanche C-Chain',
    43113: 'Avalanche Fuji',
    100: 'Gnosis Chain',
    84531: 'Base Goerli',
    8453: 'Base Mainnet'
  };
  
  return knownChains[chainId] || `Chain ${chainId}`;
}

// Configure wagmi client with multiple wallet options
const config = createConfig({
  chains: supportedChains,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [goerli.id]: http(),
  },
  connectors: [
    // For better wallet detection
    injected({ target: 'metaMask' }), // Specifically target MetaMask if available
    injected(), // Fallback for other injected wallets
    
    // For mobile wallets via QR code
    walletConnect({
      projectId: WALLET_CONNECT_PROJECT_ID,
      showQrModal: true, // Ensure QR modal is shown
      metadata: {
        name: 'Zeus Safe Signer',
        description: 'Sign Gnosis Safe transactions with Zeus',
        url: window.location.origin,
        icons: []
      }
    }),
    
    // For Coinbase Wallet
    coinbaseWallet({ 
      appName: 'Zeus Safe Signer',
      appLogoUrl: '' // You can add a logo URL here if desired
    }),
  ],
})

const queryClient = new QueryClient()

function SigningComponent() {
  const params = parseQueryParams();
  const { address, isConnected, chainId: currentChainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [isSigning, setIsSigning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [hasSimulated, setHasSimulated] = useState(false);
  
  // States for signature and success screen
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [finalSignature, setFinalSignature] = useState<string | null>(null);
  
  // Use EIP-712 typed data signing
  const { 
    signTypedData,
    isPending, 
    data: signature,
    error: signError
  } = useSignTypedData();

  // Function to submit signature to server
  const submitSignature = async (sig: string) => {
    console.log('Submitting signature to server:', sig);
    
    try {
      if (!address) {
        throw new Error('No wallet address available');
      }
      
      // Submit the signature to the server
      const response = await fetch('/api/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: sig,
          secret: params.secret,
          address: address,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Server response:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown server error');
      }
      
      return true;
    } catch (err) {
      console.error('Failed to submit signature:', err);
      setError(`Failed to submit signature: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    }
  };

  // Effect to handle signature success
  useEffect(() => {
    const handleNewSignature = async () => {
      if (signature) {
        console.log('SIGNATURE DETECTED:', signature);
        setFinalSignature(signature);
        
        try {
          // Try to submit the signature to the server
          const success = await submitSignature(signature);
          
          if (success) {
            // Only show success if submission worked
            setSignatureSubmitted(true);
          }
        } catch (err) {
          console.error('Error handling signature:', err);
        } finally {
          setIsSigning(false);
        }
      }
    };
    
    if (signature) {
      handleNewSignature();
    }
    
    if (signError) {
      console.error('Signing error:', signError);
      setError(`Signing failed: ${signError.message || 'Unknown error'}`);
      setIsSigning(false);
    }
  }, [signature, signError, address, params.secret]);
  
  // No countdown effect needed anymore
  
  // Effect to check if chain matches and update UI
  useEffect(() => {
    if (isConnected && params.typedData && currentChainId) {
      const requiredChainId = Number(params.typedData.domain.chainId);
      
      if (currentChainId !== requiredChainId) {
        // Chain mismatch detected
        setStatus(`Incorrect chain detected. Please switch to ${getChainName(requiredChainId)} (Chain ID: ${requiredChainId})`);
        setError(`Wallet is on wrong chain. Please switch to ${getChainName(requiredChainId)}.`);
      } else {
        // Chain matches what we need - clear any chain-related errors
        setError('');
      }
    }
  }, [isConnected, currentChainId, params.typedData]);
  
  // Function to get Tenderly simulation URL
  const getSimulationUrl = (): string | null => {
    if (!params.typedData) {
      return null;
    }
    
    try {
      // Extract components from the typed data
      const { domain, message } = params.typedData;
      
      // Use the chain ID directly for the network parameter
      const networkParam = `network=${domain.chainId}`;
      
      return `https://dashboard.tenderly.co/simulator/new?${
        address ? `from=${address}&` : ''
      }${networkParam}&${
        message.to ? `contractAddress=${message.to}&` : ''
      }${
        message.value ? `value=${message.value}&` : ''
      }${
        message.data ? `rawFunctionInput=${message.data}` : ''
      }`;
    } catch (err) {
      console.error('Error creating simulation URL:', err);
      return null;
    }
  };
  
  // Function to handle chain switching
  const handleSwitchChain = () => {
    if (!params.typedData) return;
    
    const requiredChainId = Number(params.typedData.domain.chainId);
    setStatus(`Switching to chain ID ${requiredChainId}...`);
    
    try {
      switchChain({ chainId: requiredChainId });
    } catch (err) {
      console.error('Failed to switch chains:', err);
      setError(`Please manually switch your wallet to ${getChainName(requiredChainId)} (Chain ID: ${requiredChainId}).`);
    }
  };
  
  // Function to handle simulate button click
  const handleSimulate = () => {
    setHasSimulated(true);
    setStatus('Simulation viewed. You can now sign the transaction.');
  };

  // Function to handle sign button click
  const handleSign = async () => {
    if (!params.typedData) {
      setError('Missing typed data parameter. Please ensure the URL contains a properly encoded typedData parameter.');
      return;
    }

    // Extract components from the typed data
    const { domain, types, primaryType, message } = params.typedData;
    
    // Check if we're on the correct chain
    const requiredChainId = Number(domain.chainId);
    if (currentChainId !== requiredChainId) {
      setError(`Chain ID mismatch. Please switch to ${getChainName(requiredChainId)} (Chain ID: ${requiredChainId}).`);
      
      // Try to switch chains
      handleSwitchChain();
      return;
    }

    // Clear previous errors and set status
    setError('');
    setIsSigning(true);
    setStatus('Please check your wallet for the signature request...');
    
    try {
      // Detailed logging of all signing parameters
      console.log('================================');
      console.log('About to sign EIP-712 typed data:');
      console.log('Domain:', domain);
      console.log('Chain ID:', domain.chainId);
      console.log('Connected Chain ID:', currentChainId);
      console.log('Types:', types);
      console.log('Primary Type:', primaryType);
      console.log('Message:', message);
      console.log('Wallet Address:', address);
      console.log('================================');
      
      // Create a modified domain with chainId as a number to ensure compatibility
      const modifiedDomain = {
        ...domain,
        chainId: typeof domain.chainId === 'number' ? domain.chainId : Number(domain.chainId)
      };
      
      console.log('Using modified domain for signing:', modifiedDomain);
      
      // Use signTypedData with the parameters from the URL
      await signTypedData({
        domain: modifiedDomain,
        types,
        primaryType,
        message,
      });
      
      // Note: The result will be handled in the useEffect hook
    } catch (err) {
      console.error('Error initiating signing:', err);
      setIsSigning(false);
      setStatus('');
      setError(`Failed to initiate signing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Show error if required parameters are missing
  if (!params.typedData || !params.secret) {
    return (
      <div className="error-container">
        <h2>Missing Required Parameters</h2>
        <p>This page requires URL parameters for signing. Please ensure the URL includes properly encoded typedData and secret parameters.</p>
      </div>
    );
  }
  
  // Show success screen if signature was submitted
  if (signatureSubmitted) {
    return (
      <div className="signing-container success-container">
        <div className="success-message">
          <span className="success-icon">✓</span>
          <h1>Transaction Signed Successfully</h1>
          <p>Signature has been submitted to Zeus.</p>
          <div className="done-message">✅ You can now close this window and return to Zeus CLI</div>
          
          <h3>Signature Details</h3>
          <div className="signature-debug">
            <div className="debug-label">Wallet Address:</div>
            <div className="debug-value">{address}</div>
            
            <div className="debug-label">Signature Value:</div>
            <div className="debug-value">{finalSignature ? finalSignature.substring(0, 20) + '...' + finalSignature.substring(finalSignature.length - 20) : 'No signature available'}</div>
            
            <div className="debug-label">Full Signature:</div>
            <div className="debug-value">{finalSignature || 'No signature available'}</div>
            
            <div className="debug-label">Chain ID:</div>
            <div className="debug-value">{currentChainId || 'Unknown'}</div>
          </div>
          
          <button className="close-button" onClick={() => window.close()}>
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signing-container">
      <h1>Zeus Safe Transaction Signing</h1>
      
      <div className="transaction-notice">
        <p>Please review all transaction details carefully</p>
      </div>
      
      <div className="transaction-details">
        <h2>Transaction Details</h2>
        
        {/* Primary Type */}
        <div className="detail-row">
          <span className="label">Message Type:</span>
          <span className="value">{params.typedData?.primaryType || 'Unknown'}</span>
        </div>
        
        {/* Domain Information */}
        <div className="detail-section">
          <h3>Domain</h3>
          <div className="detail-row">
            <span className="label">Name:</span>
            <span className="value">{params.typedData?.domain?.name || 'Unknown'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Version:</span>
            <span className="value">{params.typedData?.domain?.version || 'Unknown'}</span>
          </div>
          <div className="detail-row">
            <span className="label">Chain ID:</span>
            <span className="value">{params.typedData?.domain?.chainId || 'Unknown'}</span>
          </div>
        </div>
        
        {/* Message Content */}
        <div className="detail-section">
          <h3>Message</h3>
          {params.typedData?.message && Object.entries(params.typedData.message).map(([key, value]) => (
            <div className="detail-row" key={key}>
              <span className="label">{key}:</span>
              <span className="value">{String(value)}</span>
            </div>
          ))}
        </div>
        
        {/* Types Structure */}
        <div className="detail-section">
          <h3>Types</h3>
          {params.typedData?.types && Object.entries(params.typedData.types).map(([typeName, fields]) => (
            <div className="type-container" key={typeName}>
              <span className="type-name">{typeName}</span>
              <div className="type-fields">
                {Array.isArray(fields) && fields.map((field, index) => (
                  <div className="field-row" key={index}>
                    <span className="field-name">{field.name}</span>
                    <span className="field-type">{field.type}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {status && <div className="status-message">{status}</div>}

      {!isConnected ? (
        <div className="connect-section">
          <p className="connect-text">Select a wallet to sign this transaction</p>
          
          <div className="connectors-list">
            {/* Filter to only show MetaMask and WalletConnect */}
            {connectors
              .filter(connector => 
                connector.id === 'injected' || 
                connector.id === 'walletConnect'
              )
              .map((connector) => (
                <button
                  key={connector.uid}
                  className="connector-button"
                  data-connector={connector.id}
                  onClick={() => connect({ connector })}
                >
                  {connector.id === 'injected' ? 'MetaMask (GridPlus)' :
                   connector.id === 'walletConnect' ? 'WalletConnect (Ledger)' :
                   connector.name}
                </button>
              ))}
          </div>
        </div>
      ) : (
        <div className="connected-container">
          <div className="connected-address">
            <span className="label">Connected Address:</span>
            <span className="value">{address}</span>
            
            {params.typedData && (
              <div className="chain-info">
                <span className="label">Required Chain:</span>
                <span className={`value chain-id ${currentChainId === Number(params.typedData.domain.chainId) ? 'chain-match' : 'chain-mismatch'}`}>
                  {getChainName(Number(params.typedData.domain.chainId))} (ID: {params.typedData.domain.chainId})
                  {currentChainId !== Number(params.typedData.domain.chainId) && (
                    <>
                      <span className="chain-warning"> - Chain mismatch!</span>
                      <button 
                        className="switch-chain-button" 
                        onClick={handleSwitchChain}
                      >
                        Switch Chain
                      </button>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
          
          <div className="button-group">
            {!hasSimulated ? (
              <a 
                href={getSimulationUrl() || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="simulate-button" 
                onClick={handleSimulate}
              >
                Simulate with Tenderly
              </a>
            ) : (
              <div className="simulation-status">
                <span className="simulation-checkmark">✓</span> Simulation created
                <a 
                  href={getSimulationUrl() || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="tenderly-simple-link"
                >
                  View on Tenderly
                </a>
              </div>
            )}
            
            <button 
              className="sign-button" 
              onClick={handleSign}
              disabled={!hasSimulated || isPending || isSigning}
            >
              {isPending ? 'Check Wallet...' : 'Sign'}
            </button>
          </div>
          
          {!hasSimulated && (
            <div className="simulation-required">
              👆 Simulation required before signing
            </div>
          )}
          
          <div className="disconnect-link">
            <a href="#" onClick={(e) => { e.preventDefault(); disconnect(); }}>
              Switch wallet
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <div className="app">
          <SigningComponent />
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App