import {defaults} from 'jest-config';
import dotenv from 'dotenv';

process.env.ZAIUS_ENV = 'test';

dotenv.config({path: `.env.test`});

export default {
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  roots: ['./src'],
  testRegex: "\\.test\\.ts$",
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleFileExtensions: [
    ...defaults.moduleFileExtensions,
    'ts'
  ],
  verbose: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/test/**/*', '!src/**/index.ts'],
  testEnvironment: 'node'
};

