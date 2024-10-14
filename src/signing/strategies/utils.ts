export const SEPOLIA_CHAIN_ID = 11155111;

export function parseTuples(input: string): string[][] {
    const tupleRegex = /\((\w+),\s(0x[a-fA-F0-9]+)\)/g;
    const result: string[][] = [];
    let match;

    // Use regex to extract all tuples
    while ((match = tupleRegex.exec(input)) !== null) {
        result.push([match[1], match[2]]);
    }

    return result;
}

export function parseTuple(input: string): string[] {
    const tupleRegex = /\((.*?)\)/;
    const match = tupleRegex.exec(input);
    
    if (!match) {
        throw new Error("No tuple found in input string");
    }
    
    const tupleContent = match[1];
    const elements = tupleContent.match(/(?:[^,"']+|"[^"]*"|'[^']*')+/g);
    if (!elements) { 
        return [];
    }

    return elements.map(el => el.trim());
}