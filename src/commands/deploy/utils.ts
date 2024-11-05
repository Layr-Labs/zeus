import { sha256, toBytes } from 'viem';
import { BytecodeReference, ForgeSolidityMetadata } from '../../metadata/schema';


export function computeFairHash(bytecode: `0x${string}`, contractMetadata: ForgeSolidityMetadata): `0x${string}` {
  const immutableReferences: Record<string, BytecodeReference[]> = contractMetadata.deployedBytecode.immutableReferences ?? {};
  const modifiedBytecode = toBytes(bytecode);

  Object.values(immutableReferences).forEach((refs) => {
    Object.values(refs).forEach(({ start, length }) => {
      for (let i = start; i < (start + length); i++) {
        modifiedBytecode[i] = 0;
      }
    });
  });

  return sha256(modifiedBytecode);
}
