/** Модульные тесты логики и сопоставления данных. Отдельно от heft: тесты лежат в test/, не в src/. */
// пояс тестов — Киев, как у пользователей портала: векторы «около полуночи» рассчитаны на него. Без этого на GitHub (UTC)
// падали тесты помощника ИИ. Задаётся до запуска процессов Jest — они наследуют пояс.
process.env.TZ = 'Europe/Kyiv';
module.exports = {
  testEnvironment: 'node',
  // React 18: тесты с рендером объявляют, что действия идут через act() — иначе React предупреждает на каждом обновлении
  globals: { IS_REACT_ACT_ENVIRONMENT: true },
  roots: ['<rootDir>/test'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }] }
};
