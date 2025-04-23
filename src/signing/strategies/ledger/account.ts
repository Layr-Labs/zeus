
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid'
import Eth from '@ledgerhq/hw-app-eth';
import { toAccount } from 'viem/accounts';
import { getAddress, getTypesForEIP712Domain, hashDomain, hashStruct, HashTypedDataParameters, serializeSignature, serializeTransaction } from 'viem';

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

interface MessageTypeProperty {
    name: string
    type: string
}

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
    
        async signTypedData(_parameters) {
            const {
                domain = {},
                message,
                primaryType,
              } = _parameters as HashTypedDataParameters
            const types = {
                EIP712Domain: getTypesForEIP712Domain({ domain }),
                ..._parameters.types,
            }

            const domainSeperator = hashDomain({domain, types: types as Record<string, MessageTypeProperty[]>});
            const messageHash = hashStruct({
                data: message,
                primaryType,
                types: types as Record<string, MessageTypeProperty[]>,
              })
            
            console.log(`Requesting EIP-712 signature from ledger: `);
            console.log(JSON.stringify({domainSeperator, messageHash, path: dp}));

            const {r, s, v} = await ledger.signEIP712HashedMessage(dp, domainSeperator, messageHash)

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