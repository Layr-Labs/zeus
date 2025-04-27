// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,  
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    ignores: [
        'dist',
        'node_modules',
        'webpack.*.cjs',
        'eslint.config.mjs',
        `__mocks__`
    ]
  },
  {
    "rules": {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "args": "all",
          "argsIgnorePattern": "^_",
          "caughtErrors": "all",
          "caughtErrorsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "ignoreRestSiblings": true
        }
      ]
    }
  }
);