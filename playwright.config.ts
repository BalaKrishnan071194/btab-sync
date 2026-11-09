/**
 * Playwright Configuration for bTab Sync E2E Tests
 * 
 * Tests Chrome extension functionality.
 * Note: Extension testing requires headed mode and non-default Chrome.
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the built extension
const extensionPath = path.join(__dirname, 'dist', 'chrome');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-first-run',
            '--disable-default-apps',
          ],
          headless: false,
        },
      },
    },
  ],
});
