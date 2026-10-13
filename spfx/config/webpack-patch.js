// SDK агентов Copilot Studio: в браузере — его готовая сборка browser.mjs (иначе сборщик берёт исходники TypeScript
// из поля "browser" пакета @microsoft/agents-activity и не может их разобрать). Помощник отчёта, план 2026-10-12.
const path = require('path');
module.exports = function (config) {
  config.resolve = config.resolve || {};
  config.resolve.alias = Object.assign({}, config.resolve.alias, {
    '@microsoft/agents-copilotstudio-client$': path.resolve(__dirname, '../node_modules/@microsoft/agents-copilotstudio-client/dist/src/browser.mjs')
  });
  return config;
};
