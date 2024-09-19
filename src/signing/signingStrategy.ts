

interface SigningStrategy {
    id(): string;
    // sign some calldata
    signCalldata(calldata: `0x${string}`): Promise<`0x${string}`>;
}