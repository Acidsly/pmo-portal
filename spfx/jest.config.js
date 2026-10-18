/** Модульные тесты логики и сопоставления данных. Отдельно от heft: тесты лежат в test/, не в src/. */
// пояс тестов — Киев, как у пользователей портала: векторы «около полуночи» рассчитаны на него. Без этого на GitHub (UTC)
// падали тесты помощника ИИ. Задаётся до запуска процессов Jest — они наследуют пояс.
process.env.TZ = 'Europe/Kyiv';
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }] }
};
