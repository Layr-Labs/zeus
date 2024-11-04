export function parseTuples(input: string): (string | boolean)[][] {
    const tupleRegex = /\((0x[a-fA-F0-9]+),\s*([\w]*)\s*,\s*(true|false)\)/g;
    const result: (string | boolean)[][] = [];
    let match;

    // Use regex to extract all tuples
    while ((match = tupleRegex.exec(input)) !== null) {
        const address = match[1];
        const secondValue = match[2] || "";  // Use empty string if the second value is missing
        const booleanValue = match[3] === "true";  // Convert to boolean
        result.push([address, secondValue, booleanValue]);
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