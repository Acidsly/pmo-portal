const spfxProfile = require('@microsoft/eslint-config-spfx/lib/flat-profiles/react');

module.exports = [
  // тесты (test/) собирает ts-jest по tsconfig.jest.json, в программу сборки они не входят: с Heft 1.3 линтер сборки
  // иначе требует для них типы и падает (до 1.3 он их просто не видел)
  { ignores: ['test/**'] },
  ...spfxProfile,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.json'
      }
    },
    rules: {
      // REST SharePoint возвращает null для пустых полей — модель данных описывает это явно
      '@rushstack/no-new-null': 'off'
    }
  }
];
