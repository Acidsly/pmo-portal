/** Модульные тесты логики и сопоставления данных. Отдельно от heft: тесты лежат в test/, не в src/. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }] }
};
