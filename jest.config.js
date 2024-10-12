/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: "node",
  transform: {
    "^.+.tsx?$": ["ts-jest",{}],
  },
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
  coverageThreshold: {
      "global": {
          "branches": 20,
          "functions": 30,
          "lines": 50,
          "statements": 50
      }
    },
};