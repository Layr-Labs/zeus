
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid'
import Eth from '@ledgerhq/hw-app-eth';
import type { EIP712Message, EIP712MessageTypes, EIP712MessageTypesEntry } from '@ledgerhq/types-live';
import { toAccount } from 'viem/accounts';
import { getAddress, getTypesForEIP712Domain, serializeSignature, serializeTransaction, type TypedData, type TypedDataDefinition, type TypedDataDomain } from 'viem';

export const BASE_DERIVATION_PATH = `44'/60'/0'/0`

// TODO: Delete this entire file after (https://github.com/celo-org/developer-tooling/pull/505) merges.
interface TLedgerAccountArgs {
    derivationPath?: `${typeof BASE_DERIVATION_PATH}${string}`
}

export const derivationPathAtIndex = (index: number) => {
    return `${BASE_DERIVATION_PATH}/${index}`;
}

export const ensureLeading0x = (input: string): `0x${string}` =>
    input.startsWith('0x') ? (input as `0x${string}`) : `0x${input}`;

export const trimLeading0x = (input: string | `0x${string}`): string => input.startsWith(`0x`) ? input.substring(2) : input;

export const DEFAULT_DERIVATION_PATH  = `44'/60'/0'/0/0` // derivationPathAtIndex(0)

type MessageTypeProperty = EIP712MessageTypesEntry;

let _ledger: Eth | undefined;
export const getLedger: () => Promise<Eth> = async () => {
    if (_ledger !== undefined) {
        return _ledger;
    }

    _ledger = new Eth(await TransportNodeHid.open(''));
    return _ledger;
}

// based off the idea from (https://github.com/celo-org/developer-tooling/blob/master/packages/viem-account-ledger/src/ledger-to-account.ts),
// which was missing TypedData support.
export const ledgerToAccount = async ({
    derivationPath
}: TLedgerAccountArgs) => {
    const ledger = await getLedger();
    const dp = derivationPath === undefined ? DEFAULT_DERIVATION_PATH : derivationPath;
    const { address, publicKey } = await ledger.getAddress(dp, true)

    const account = toAccount({
        address: getAddress(address),
    
        async signTransaction(transaction) {
            const hash = serializeTransaction(transaction)
            const signedTxn = await ledger.signTransaction(dp, trimLeading0x(hash), null);
            let { v: _v } = signedTxn;
            const { r, s } = signedTxn;
            if (typeof _v === 'string' && (_v === '' || _v === '0x')) {
                _v = '0x0'
            }
            let v: bigint
            try {
                v = BigInt(typeof _v === 'string' ? ensureLeading0x(_v) : _v)
            } catch (err) {
                throw new Error(
                `Ledger signature \`v\` was malformed and couldn't be parsed \`${_v}\` (Original error: ${err})`
                )
            }
            return serializeTransaction(transaction, {
                r: ensureLeading0x(r),
                s: ensureLeading0x(s),
                v,
            })
        },
    
        async signMessage({ message }) {
            const {r, s, v} = await ledger.signPersonalMessage(dp, `0x${Buffer.from(message as string).toString('hex')}`)
            return serializeSignature({
                r: ensureLeading0x(r),
                s: ensureLeading0x(s),
                v: BigInt(v),
            })
        },
    
        async signTypedData<
            TTypedData extends TypedData | Record<string, unknown>,
            TPrimaryType extends keyof TTypedData | 'EIP712Domain' = keyof TTypedData
        >(_parameters: TypedDataDefinition<TTypedData, TPrimaryType>) {
            const {
                domain = {},
                message,
                primaryType,
              } = _parameters
            // Normalize types into Ledger's EIP-712 struct definitions
            const domainTypeEntries: EIP712MessageTypesEntry[] = getTypesForEIP712Domain({ domain: domain as TypedDataDomain }).map(({ name, type }) => ({ name, type: type as string }))
            const inputTypes = (_parameters.types ?? {}) as Record<string, readonly { name: string; type: string }[]>
            const otherTypeEntries: Record<string, EIP712MessageTypesEntry[]> = Object.fromEntries(
                Object.entries(inputTypes).map(([key, entries]) => [
                    key,
                    entries.map(({ name, type }) => ({ name, type })),
                ]),
            )
            const ledgerTypes: EIP712MessageTypes = {
                EIP712Domain: domainTypeEntries,
                ...otherTypeEntries,
            }

            // Normalize domain for Ledger (chainId must be a number)
            const d = domain as Record<string, unknown>
            const domainForLedger: EIP712Message['domain'] = {}
            if (typeof d.name === 'string') domainForLedger.name = d.name
            if (typeof d.version === 'string') domainForLedger.version = d.version
            if (typeof d.verifyingContract === 'string') domainForLedger.verifyingContract = d.verifyingContract
            if (typeof d.salt === 'string') domainForLedger.salt = d.salt
            if (typeof d.chainId === 'number') domainForLedger.chainId = d.chainId
            else if (typeof d.chainId === 'bigint') domainForLedger.chainId = Number(d.chainId)

            const typedData: EIP712Message = {
                types: ledgerTypes,
                domain: domainForLedger,
                primaryType: primaryType as string,
                message: message as Record<string, unknown>,
            }

            console.log(`Requesting EIP-712 signature from ledger (typed data): `);
            console.log(JSON.stringify({ path: dp }));

            const {r, s, v} = await ledger.signEIP712Message(dp, typedData)

            return serializeSignature({
                r: ensureLeading0x(r),
                s: ensureLeading0x(s),
                v: BigInt(v),
            })
        },
    })
    
    return {
        ...account,
        publicKey: ensureLeading0x(publicKey),
        source: 'ledger',
    }
};
