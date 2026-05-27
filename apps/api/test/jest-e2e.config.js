module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@prisma/client$': '<rootDir>/src/test/__mocks__/prisma-client.ts',
    '^bcrypt$': '<rootDir>/test/helpers/__mocks__/bcrypt.ts',
    '^svg-captcha$': '<rootDir>/test/helpers/__mocks__/svg-captcha.ts',
    '^ioredis$': '<rootDir>/test/helpers/__mocks__/ioredis.ts',
  },
  setupFiles: ['<rootDir>/test/jest-env.setup.js'],
  testTimeout: 30000,
};
