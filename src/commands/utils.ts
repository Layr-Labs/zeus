
import p from 'prompt-sync';

const ask = p({sigint: true});
const defaultMaxAttempts = 5;

export const question = (args: {
    text: string, 
    isValid: (text: string) => boolean
    maxAttempts: number
    errorMessage: string
}) => {
    var attempt = 0;
    var response: string = '';
    while (attempt < (args.maxAttempts || defaultMaxAttempts)) {
        response = ask(args.text + ': ')
        if (args.isValid(response)) {
            return response;
        }
        attempt++;
    }

    throw new Error(args.errorMessage);
};