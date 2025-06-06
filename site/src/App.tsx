import { useEffect, useState, useMemo } from 'react'
import './App.css'
import { createConfig, http } from '@wagmi/core'
import { mainnet, sepolia, holesky } from '@wagmi/core/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { 
  WagmiProvider, 
  useDisconnect, 
  useAccount, 
  useConnect, 
  useSignTypedData, 
  useSwitchChain,
  useReadContract,
} from 'wagmi'
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors'
import { abi as safeAbi } from './Safe';
import { encodeFunctionData, encodePacked, hashTypedData } from 'viem'

// Using WalletConnect with a valid project ID
const WALLET_CONNECT_PROJECT_ID = '2a1cb39c11c473fcfb2a02856fe6697a'

function approvalSignature(signer: `0x${string}`) {
  const paddedSigner = `0x${'0'.repeat(24)}${signer.slice(2)}` as `0x${string}`;
  return encodePacked(['bytes32', 'bytes32', 'bytes1'], [
      paddedSigner, /* r */
      ('0x' + '0'.repeat(64)) as `0x${string}`, /* s */
      `0x01` /* v - indicating that this is an approval */
  ])
}

function parseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  
  // Get the encoded EIP712 data from the typedData parameter
  const typedDataParam = params.get('typedData');
  const rawMessageParam = params.get('rawMessage');
  
  // Parse the encoded typed data if it exists
  let typedData = null;
  if (typedDataParam) {
    try {
      typedData = JSON.parse(decodeURIComponent(typedDataParam));
    } catch (err) {
      console.error('Failed to parse typed data from URL parameter:', err);
    }
  }
  
  // Parse the raw message if it exists
  let rawMessage = null;
  if (rawMessageParam) {
    try {
      rawMessage = JSON.parse(decodeURIComponent(rawMessageParam));
      console.log('Parsed raw message data:', rawMessage);
    } catch (err) {
      console.error('Failed to parse raw message from URL parameter:', err);
    }
  }
  
  return {
    typedData, // The parsed EIP-712 typed data object
    rawMessage, // The parsed raw message object
    secret: params.get('secret'),
  };
}

// Define supported chains for our app
const supportedChains = [mainnet, sepolia, holesky] as const;

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
    [mainnet.id]: http('https://eth.llamarpc.com'),
    [sepolia.id]: http('https://sepolia.gateway.tenderly.co'),
    [holesky.id]: http('https://holesky.gateway.tenderly.co'),
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
      appLogoUrl: '' 
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
  
  // States for owner validation
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  
  // State for view mode (parsed or raw)
  const [viewMode, setViewMode] = useState<'parsed' | 'raw'>('parsed');

  // Use EIP-712 typed data signing
  const { 
    signTypedData,
    isPending, 
    data: signature,
    error: signError
  } = useSignTypedData();

  const messageHash = useMemo(() => {
    if (!params) return '';

    return hashTypedData(params.typedData);
  },[params]);

  useEffect(() => {
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
  
  // Get the Safe address from typedData
  const safeAddress = params.typedData?.domain?.verifyingContract as `0x${string}` | undefined;
  const safeChainId = params.typedData ? Number(params.typedData.domain.chainId) : undefined;
  
  // Use wagmi to directly check if the connected address is an owner of the Safe contract
  const { data: isOwnerData, isLoading: isOwnerLoading, error: isOwnerError } = useReadContract({
    address: safeAddress,
    abi: safeAbi,
    functionName: 'isOwner',
    args: address ? [address] : undefined,
    chainId: safeChainId,
    query: {
      enabled: !!address && !!safeAddress && !!safeChainId && isConnected,
    }
  });

  // Update the isOwner state when the contract read returns
  useEffect(() => {
    if (isOwnerData !== undefined) {
      setIsOwner(isOwnerData);
      
      if (!isOwnerData) {
        setError(`Connected wallet (${address}) is not a signer for this Safe. Please connect a wallet that is authorized to sign.`);
      } else {
        // Clear error if it was about not being an owner
        if (error && error.includes('not a signer')) {
          setError('');
        }
      }
    }
  }, [isOwnerData, address, error]);
  
  
  // Log any errors from contract reads
  useEffect(() => {
    if (isOwnerError) {
      console.error('Error checking if address is owner:', isOwnerError);
      setError(`Could not verify if you're a signer: ${isOwnerError instanceof Error ? isOwnerError.message : 'Unknown error'}`);
    }
  }, [isOwnerError]);
  
  // Effect to check if chain matches and update UI
  useEffect(() => {
    if (isConnected && params.typedData && currentChainId) {
      const requiredChainId = Number(params.typedData.domain.chainId);
      
      if (currentChainId !== requiredChainId) {
        // Chain mismatch detected
        setStatus(`Incorrect chain detected. Please switch to ${getChainName(requiredChainId)} (Chain ID: ${requiredChainId})`);
        setError(`Wallet is on wrong chain. Please switch to ${getChainName(requiredChainId)}.`);
      } else {
        // Chain matches what we need - clear chain-related errors only
        if (error && error.includes('wrong chain')) {
          setError('');
        }
      }
    }
  }, [isConnected, currentChainId, error, params.typedData]);
  
  // Function to get Tenderly simulation URL
  const simulationUrl = useMemo(() => {
    if (!params.typedData) {
      return null;
    }
    
    try {
      const { domain, message } = params.typedData;

      const {to, value, data} = message;
      const signatures = approvalSignature(address!);

      const thresholdOverride = [
        {
          "contractAddress": domain.verifyingContract,
          "balance": "",
          "storage": [
            {
              "key": "0x0000000000000000000000000000000000000000000000000000000000000004", // threshold storage slot
              "value": "0x0000000000000000000000000000000000000000000000000000000000000001" // set to 1.
            }
          ],
          "open": true
        }
      ];

      const actualData = encodeFunctionData({
        abi: safeAbi,
        functionName: 'execTransaction',
        args: [
          to,
          BigInt(value),
          data,
          message.operation,
          BigInt(message.safeTxGas),
          BigInt(message.baseGas),
          BigInt(message.gasPrice),
          message.gasToken as `0x${string}`,
          message.refundReceiver as `0x${string}`,
          signatures
        ]
      })
      const actualTo = params.typedData?.domain?.verifyingContract as `0x${string}`;
      return `https://dashboard.tenderly.co/simulator/new?from=${address}&network=${domain.chainId}&contractAddress=${actualTo}&value=${message.value}&rawFunctionInput=${actualData}&stateOverrides=${encodeURIComponent(JSON.stringify(thresholdOverride))}`
    } catch (err) {
      console.error('Error creating simulation URL:', err);
      return null;
    }
  }, [address, params]);
  
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
    
    // Check if user is a signer
    if (isOwnerLoading) {
      setStatus('Checking if your wallet is authorized to sign...');
      return; // Wait for the check to complete
    }
    
    if (isOwner === false) {
      setError(`This wallet (${address}) is not authorized to sign transactions for this Safe. Please connect a wallet that is a signer.`);
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
        
        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <button 
            className={`toggle-button ${viewMode === 'parsed' ? 'active' : ''}`}
            onClick={() => setViewMode('parsed')}
          >
            Parsed View
          </button>
          <button 
            className={`toggle-button ${viewMode === 'raw' ? 'active' : ''}`}
            onClick={() => setViewMode('raw')}
          >
            Raw Message
          </button>
        </div>

        <div className="detail-row">
          <span className="label">Message Hash:</span>
          <span className="value">{messageHash || 'Unknown'}</span>
        </div>
        
        {viewMode === 'parsed' ? (
          <>
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
              <div className="detail-row">
                <span className="label">Verifying Contract:</span>
                <span className="value">{params.typedData?.domain?.verifyingContract || 'Unknown'}</span>
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
          </>
        ) : (
          <div className="raw-message-container">
            <h3>Raw Typed Data</h3>
            <pre className="raw-message-pre">
              {JSON.stringify(params.typedData, null, 2)}
            </pre>
          </div>
        )}
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
                  {connector.id === 'injected' ? 'MetaMask' :
                   connector.id === 'walletConnect' ? 'WalletConnect' :
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
            
            {/* Display signer status */}
            {isOwnerLoading ? (
              <div className="signer-status is-checking">
                <span className="checking-badge">🔄 Checking authorization...</span>
              </div>
            ) : isOwner !== null && (
              <div className={`signer-status ${isOwner ? 'is-signer' : 'not-signer'}`}>
                {isOwner ? 
                  <span className="signer-badge">✓ Authorized Signer</span> :
                  <span className="not-signer-badge">❌ Not a signer for this Safe</span>
                }
              </div>
            )}
            
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
                href={simulationUrl || '#'}
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
                  href={simulationUrl || '#'} 
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
              disabled={!hasSimulated || isPending || isSigning || isOwner === false || isOwnerLoading}
              title={
                isOwnerLoading ? 'Checking authorization...' :
                isOwner === false ? 'Only authorized signers can sign transactions' :
                ''
              }
            >
              {isPending ? 'Check Wallet...' : 
               isOwnerLoading ? 'Checking Authorization...' : 
               isOwner === false ? 'Not Authorized' : 
               'Sign'}
            </button>
          </div>
          
          {!hasSimulated && (
            <div className="simulation-required">
              👆 Simulation required before signing
            </div>
          )}
          
          <div className="disconnect-link">
            <a href="#" onClick={(e) => { e.preventDefault(); disconnect(); setIsOwner(null); }}>
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