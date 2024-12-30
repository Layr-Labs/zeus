// You will need to have "node-fetch" installed for this to run in Node.js environments.
// npm install node-fetch
// If using TypeScript and ES modules, ensure your tsconfig allows "esModuleInterop": true

import fetch, { Response, RequestInit } from 'node-fetch';

interface ForkConfig {
  network_id: string;
  block_number?: string;
}

interface ChainConfig {
  chain_id: number;
}

interface SyncStateConfig {
  enabled?: boolean;
}

interface ExplorerPageConfig {
  enabled?: boolean;
  verification_visibility?: 'abi' | 'src' | 'bytecode';
}

interface VirtualNetworkConfig {
  chain_config: ChainConfig;
  sync_state_config?: SyncStateConfig;
  explorer_page_config?: ExplorerPageConfig;
}

interface RpcEndpoint {
  url: string;
  name: string;
}

interface VirtualTestNetResponse {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  fork_config?: ForkConfig;
  virtual_network_config?: VirtualNetworkConfig;
  sync_state_config?: SyncStateConfig;
  explorer_page_config?: ExplorerPageConfig;
  rpcs?: RpcEndpoint[];
}

interface CreateVirtualNetworkRequest {
  slug: string;
  display_name?: string;
  description?: string;
  fork_config: {
    network_id: string;
    block_number?: string;
  };
  virtual_network_config: {
    chain_config: {
      chain_id: number;
    };
    sync_state_config?: {
      enabled?: boolean;
    };
    explorer_page_config?: {
      enabled?: boolean;
      verification_visibility?: 'abi' | 'src' | 'bytecode';
    };
  };
}

interface StateOverride {
  nonce?: number;
  code?: string;
  balance?: string;
  storage?: Record<string, string>;
}

interface TransactionResponse {
  id: string;
  vnet_id: string;
  origin: string;
  category: string;
  kind: string;
  status: string;
  error_reason?: string;
  rpc_method: string;
  created_at: string;
  block_number: string;
  block_hash: string;
  tx_hash: string;
  tx_index: string;
  from: string;
  to: string;
  input: string;
  nonce: string;
  value: string;
  gas: string;
  gas_price: string;
  max_priority_fee_per_gas?: string;
  max_fee_per_gas?: string;
  signature: string;
  type: string;
  stateOverrides?: Record<string, StateOverride>;
  blockOverrides?: {
    number?: string;
    timestamp?: string;
  };
  function_name?: string;
}

interface ListTransactionsParams {
  category?: 'write' | 'read' | 'compute';
  kind?: 'blockchain' | 'simulation' | 'cheatcode' | 'cheatcode_faucet';
  status?: 'success' | 'failed' | 'pending';
  page?: number;
  perPage?: number;
}

interface BlockOverrides {
  number?: string;
  timestamp?: string;
}

interface CallArgs {
  from: string;
  to?: string;
  gas?: string;
  gasPrice?: string;
  value?: string;
  data?: string;
}

interface SendTransactionRequest {
  callArgs: CallArgs;
  blockOverrides?: BlockOverrides;
  stateOverrides?: Record<string, StateOverride>;
}

interface SimulateTransactionRequest {
  callArgs: CallArgs;
  blockNumber?: string;
  blockOverrides?: BlockOverrides;
  stateOverrides?: Record<string, StateOverride>;
}

interface SimulationLog {
  anonymous?: boolean;
  inputs?: { name: string; type: string; value: string }[];
  name?: string;
  raw?: {
    address: string;
    data: string;
    topics: string[];
  };
}

interface SimulationTrace {
  decodedInput?: { name: string; type: string; value: string }[];
  decodedOutput?: { name: string; type: string; value: string|boolean }[];
  from?: string;
  to?: string;
  gas?: string;
  gasUsed?: string;
  input?: string;
  method?: string;
  output?: string;
  subtraces?: number;
  traceAddress?: number[];
  type?: string;
  value?: string;
}

interface SimulationResponse {
  blockNumber: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  logs: SimulationLog[];
  logsBloom: string;
  status: boolean;
  trace: SimulationTrace[];
}

export class TenderlyVirtualTestnetClient {
  private accessKey: string;
  private baseUrl: string;
  private accountSlug: string;
  private projectSlug: string;

  /**
   * Create a new Tenderly Virtual Testnet Client.
   * @param accessKey - Your Tenderly X-Access-Key token.
   * @param accountSlug - Account slug of the user/organization.
   * @param projectSlug - Project slug of the account.
   * @param baseUrl - Base URL for the Tenderly API (default: "https://api.tenderly.co/api")
   */
  constructor(accessKey: string, accountSlug: string, projectSlug: string, baseUrl = 'https://api.tenderly.co/api') {
    this.accessKey = accessKey;
    this.accountSlug = accountSlug;
    this.projectSlug = projectSlug;
    this.baseUrl = baseUrl;
  }

  /**
   * Helper method to handle HTTP requests.
   * @param endpoint - API endpoint (relative to baseUrl)
   * @param options - fetch options
   * @private
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      ...options.headers,
      'X-Access-Key': this.accessKey,
      'Content-Type': 'application/json',
    };

    const response: Response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed with status ${response.status}: ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json() as Promise<T>;
    } else {
      return {} as T;
    }
  }

  /**
   * Get Virtual TestNet by ID.
   * @param vnetId - ID of the Virtual TestNet.
   */
  public async getVirtualTestNetById(vnetId: string): Promise<VirtualTestNetResponse> {
    const endpoint = `/v1/account/${encodeURIComponent(this.accountSlug)}/project/${encodeURIComponent(this.projectSlug)}/vnets/${encodeURIComponent(vnetId)}`;
    return this.request<VirtualTestNetResponse>(endpoint, { method: 'GET' });
  }

  /**
   * Delete Virtual TestNet by ID.
   * @param vnetId - ID of the Virtual TestNet.
   */
  public async deleteVirtualTestNetById(vnetId: string): Promise<void> {
    const endpoint = `/v1/account/${encodeURIComponent(this.accountSlug)}/project/${encodeURIComponent(this.projectSlug)}/vnets/${encodeURIComponent(vnetId)}`;
    await this.request<unknown>(endpoint, { method: 'DELETE' });
  }

  /**
   * Create a new Virtual Network.
   * @param data - CreateVirtualNetworkRequest object.
   */
  public async createVirtualNetwork(data: CreateVirtualNetworkRequest): Promise<VirtualTestNetResponse> {
    const endpoint = `/v1/account/${encodeURIComponent(this.accountSlug)}/project/${encodeURIComponent(this.projectSlug)}/vnets`;
    return this.request<VirtualTestNetResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get a transaction by hash on a virtual network.
   * @param vnetId - Virtual network ID.
   * @param txHash - Transaction hash.
   */
  public async getTransactionByHash(vnetId: string, txHash: string): Promise<TransactionResponse> {
    const endpoint = `/v1/account/${encodeURIComponent(this.accountSlug)}/project/${encodeURIComponent(this.projectSlug)}/vnets/${encodeURIComponent(vnetId)}/transactions/${encodeURIComponent(txHash)}`;
    return this.request<TransactionResponse>(endpoint, { method: 'GET' });
  }

  /**
   * Send a transaction to be executed on a virtual network.
   * @param vnetId - Virtual network ID.
   * @param data - SendTransactionRequest object.
   */
  public async sendTransaction(vnetId: string, data: SendTransactionRequest): Promise<TransactionResponse> {
    const endpoint = `/v1/account/${encodeURIComponent(this.accountSlug)}/project/${encodeURIComponent(this.projectSlug)}/vnets/${encodeURIComponent(vnetId)}/transactions`;
    return this.request<TransactionResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get transactions on virtual network with pagination and optional filters.
   * @param vnetId - Virtual network ID.
   * @param params - Optional query params (category, kind, status, page, perPage).
   */
  public async getTransactionsOnVirtualNetwork(vnetId: string, params?: ListTransactionsParams): Promise<TransactionResponse[]> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.kind) query.set('kind', params.kind);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.perPage) query.set('perPage', params.perPage.toString());

    const endpoint = `/v1/account/${encodeURIComponent(this.accountSlug)}/project/${encodeURIComponent(this.projectSlug)}/vnets/${encodeURIComponent(vnetId)}/transactions?${query.toString()}`;
    return this.request<TransactionResponse[]>(endpoint, { method: 'GET' });
  }

  /**
   * Simulate a transaction on a virtual network without persisting state.
   * @param vnetId - Virtual network ID.
   * @param data - Simulation request data.
   */
  public async simulateTransaction(vnetId: string, data: SimulateTransactionRequest): Promise<SimulationResponse> {
    const endpoint = `/v1/account/${encodeURIComponent(this.accountSlug)}/project/${encodeURIComponent(this.projectSlug)}/vnets/${encodeURIComponent(vnetId)}/transactions/simulate`;
    return this.request<SimulationResponse>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
