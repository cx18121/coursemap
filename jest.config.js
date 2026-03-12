/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Map next/headers to a mock for unit tests (not available outside Next.js runtime)
    '^next/headers$': '<rootDir>/src/lib/__mocks__/next-headers.ts',
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx|mjs)$': ['ts-jest', {
      tsconfig: {
        // Use CommonJS for Jest compatibility
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowJs: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  // Transform ESM-only packages (jose uses ESM with export syntax)
  transformIgnorePatterns: [
    '/node_modules/(?!(jose|@panva|oidc-token-hash)/)',
  ],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
  extensionsToTreatAsEsm: [],
};

module.exports = config;
