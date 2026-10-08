module.exports = {
  moduleFileExtensions: ['js', 'json'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.(spec|test)\\.js$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.js$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: { syntax: 'typescript', decorators: true, dynamicImport: true },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
            useDefineForClassFields: false,
          },
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.js'],
  coverageDirectory: './coverage',
  testTimeout: 30000,
  setupFiles: ['<rootDir>/tests/setup-env.js'],
};
