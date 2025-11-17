const commonProjectConfig = {
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^.+\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^.+\\.(module\\.css)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: './tsconfig.json',
        diagnostics: {
          ignoreCodes: ['TS151001']
        }
      }
    ]
  },
  transformIgnorePatterns: ['/node_modules/(?!(until-async)/)']
};

export default {
  testTimeout: 30000,
  projects: [
    {
      displayName: 'client',
      preset: 'ts-jest/presets/default-esm',
      testEnvironment: 'jsdom',
      setupFiles: ['<rootDir>/jest.polyfills.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      testMatch: ['<rootDir>/apps/web/**/*.(test|spec).(ts|tsx)', '<rootDir>/tests/lib/**/*.(test|spec).ts'],
      ...commonProjectConfig
    },
    {
      displayName: 'server',
      preset: 'ts-jest/presets/default-esm',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/jest.polyfills.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.server.setup.ts'],
      testMatch: ['<rootDir>/tests/api/**/*.(test|spec).ts'],
      ...commonProjectConfig
    }
  ]
};
