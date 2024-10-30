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
        'webpack.config.cjs',
        'eslint.config.mjs',
    ]
  }
);