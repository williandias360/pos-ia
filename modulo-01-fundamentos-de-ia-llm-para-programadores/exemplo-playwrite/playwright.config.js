const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 5_000,
  expect: {
    timeout: 5_000
  },
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'https://erickwendel.github.io',
    actionTimeout: 5_000,
    navigationTimeout: 5_000
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});