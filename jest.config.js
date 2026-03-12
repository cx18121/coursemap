/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['ts-jest', {
      tsconfig: {
        // Use CommonJS for Jest compatibility
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowJs: true,
      },
    }],
  },
  transformIgnorePatterns: [
    // Don't ignore node_modules except for specific ESM packages
    '/node_modules/(?!(@testing-library)/)',
  ],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
};

module.exports = config;
