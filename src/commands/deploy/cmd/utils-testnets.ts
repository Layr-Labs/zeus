import { createPublicClient, createTestClient, Hex, http, toHex, TransactionRequest } from "viem";

export interface TestClient {
    setBalance(address: Hex, value: bigint): Promise<void>
    fastForward(nextTimestamp: bigint): Promise<void>
    sendUnsignedTransaction(txn: TransactionRequest): Promise<`0x${string}`>
}

type TTestClient = Awaited<ReturnType<typeof createTestClient>>;
type TPublicClient = Awaited<ReturnType<typeof createPublicClient>>;

export class AnvilTestClient implements TestClient {
    client: TTestClient;

    constructor(testClient: TTestClient) {
        this.client = testClient;
    }

    async setBalance(address: Hex, value: bigint) {
        await this.client.setBalance({address, value});
    }

    async fastForward(nextTimestamp: bigint) {
        await this.client.setNextBlockTimestamp({
            timestamp: nextTimestamp,
        })
        await this.client.mine({blocks: 1000});
    }

    async sendUnsignedTransaction(txn: TransactionRequest): Promise<`0x${string}`> {
        return await this.client.sendUnsignedTransaction(txn);
    }
}

interface TTenderlyTransaction {
    from: `0x${string}`,
    to: `0x${string}`
    gas?: `0x${string}`
    gasPrice?: `0x${string}`,
    value?: `0x${string}`,
    data?: `0x${string}`
}

type TSetBalanceParams = [addresses: Hex[], value: Hex];
type TSetNextBlockTimestampParams = [bigint];
type TEvmIncreaseBlocksParams = [Hex];
type TSendUnsignedTransactionParams = [TTenderlyTransaction]
 
export class TenderlyTestClient implements TestClient {
    client: TPublicClient;

    constructor(rpcUrl: string) {
        this.client = createPublicClient({transport: http(rpcUrl)});
    }

    async setBalance(address: Hex, value: bigint) {
        await this.client.request<{
            method: 'tenderly_setBalance',
            Parameters: TSetBalanceParams,
            ReturnType: Hex
          }>({
            method: 'tenderly_setBalance',
            params: [[address], toHex(value)]
          })
    }

    async sendUnsignedTransaction(txn: TransactionRequest): Promise<`0x${string}`> {
        if (!txn.to || !txn.from) {
            throw new Error(`Invalid transaction. (from/to required)`);
        }
        const tenderlyTxn = {
            from: txn.from as `0x${string}`,
            to: txn.to as `0x${string}`,
            gas: txn.gas !== undefined ? toHex(txn.gas) : undefined,
            gasPrice: txn.gasPrice !== undefined ? toHex(txn.gasPrice) : undefined,
            value: txn.value !== undefined ? toHex(txn.value) : undefined,
            data: txn.data,
        }
        return await this.client.request<{
            method: 'eth_sendTransaction',
            Parameters: TSendUnsignedTransactionParams,
            ReturnType: Hex
          }>({
            method: 'eth_sendTransaction',
            params: [tenderlyTxn]
          })
    }

    async fastForward(nextTimestamp: bigint) {
        // move time forward
        await this.client.request<{
            method: 'evm_setNextBlockTimestamp',
            Parameters: TSetNextBlockTimestampParams,
            ReturnType: Hex
          }>({
            method: 'evm_setNextBlockTimestamp',
            params: [nextTimestamp]
          });

        // skip 200 blocks
        await this.client.request<{
            method: 'evm_increaseBlocks',
            Parameters: TEvmIncreaseBlocksParams,
            ReturnType: Hex
            }>({
            method: 'evm_increaseBlocks',
            params: [toHex(200)] 
        });
    }
}
