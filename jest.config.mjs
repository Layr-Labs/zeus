/** @type {import('ts-jest').JestConfigWithTsJest} **/

import { createDefaultEsmPreset } from 'ts-jest';

const defaultEsmPreset = createDefaultEsmPreset()

export default {
  ...defaultEsmPreset,
  testEnvironment: "node",
  rootDir: "src",
  testMatch: ["**/*.spec.ts"],
  coveragePathIgnorePatterns: [
        "node_modules",
        "test-config",
        "interfaces",
        "jestGlobalMocks.ts",
        ".module.ts",
        "<rootDir>/src/app/main.ts",
        ".mock.ts"
    ],
  coverageDirectory: "../coverage/",
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/tests',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  coverageReporters: ['html', 'lcov'],
  coverageThreshold: {
      "global": {
          "branches": 1,
          "functions": 1,
          "lines": 1,
          "statements": 1  
      }
    },
};