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
        ".mock.ts",
        "src/tests"
  ],
  coverageDirectory: "../coverage/",
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/tests',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  extensionsToTreatAsEsm: [".ts", ".tsx"],
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