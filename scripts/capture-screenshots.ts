/**
 * Capture Screenshots for README Documentation
 * 
 * Uses Playwright to capture high-quality screenshots of bTab Sync extension.
 * Run: npx tsx scripts/capture-screenshots.ts
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.join(__dirname, '..', 'dist', 'chrome');
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreenshots(): Promise<void> {
  console.log('🚀 Starting screenshot capture...\n');
  console.log(`Extension path: ${EXTENSION_PATH}`);
  console.log(`Screenshots dir: ${SCREENSHOTS_DIR}\n`);

  // Launch browser with extension
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-component-extensions-with-background-pages',
    ],
    viewport: { width: 1400, height: 900 },
  });

  try {
    // Wait for extension to load
    let background = context.serviceWorkers()[0];
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 15000 });
    }
    const extensionId = background.url().split('/')[2];
    console.log(`✅ Extension loaded: ${extensionId}\n`);

    // Open some test tabs for screenshots
    const page1 = await context.newPage();
    await page1.goto('https://github.com');
    await delay(1000);

    const page2 = await context.newPage();
    await page2.goto('https://google.com');
    await delay(1000);

    const page3 = await context.newPage();
    await page3.goto('https://stackoverflow.com');
    await delay(1000);

    // Open a page where we'll trigger the extension
    const mainPage = await context.newPage();
    await mainPage.goto('https://example.com');
    await delay(500);

    // Trigger extension via keyboard shortcut
    console.log('📸 Triggering extension...');
    await mainPage.keyboard.press('Control+Shift+K');
    await delay(1500);

    // Screenshot 1: Main panel (dark mode)
    console.log('📸 Capturing: main-panel-dark.png');
    const panel = await mainPage.locator('#omni-switcher-host').first();
    if (await panel.isVisible()) {
      // Get the shadow root element
      await mainPage.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'main-panel-dark.png'),
        clip: {
          x: 800,
          y: 0,
          width: 500,
          height: 700,
        },
      });
      console.log('  ✓ main-panel-dark.png');
    } else {
      // Try full page screenshot
      await mainPage.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'main-panel-dark.png'),
      });
      console.log('  ✓ main-panel-dark.png (full page)');
    }

    // Screenshot 2: Search in action
    console.log('📸 Capturing: search-feature.png');
    await mainPage.keyboard.type('github');
    await delay(800);
    await mainPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'search-feature.png'),
      clip: {
        x: 800,
        y: 0,
        width: 500,
        height: 700,
      },
    });
    console.log('  ✓ search-feature.png');

    // Clear search
    await mainPage.keyboard.press('Escape');
    await delay(300);
    await mainPage.keyboard.press('Control+Shift+K');
    await delay(1000);

    // Screenshot 3: Focus mode command
    console.log('📸 Capturing: focus-mode.png');
    await mainPage.keyboard.type('/focus');
    await delay(800);
    await mainPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'focus-mode.png'),
      clip: {
        x: 800,
        y: 0,
        width: 500,
        height: 700,
      },
    });
    console.log('  ✓ focus-mode.png');

    console.log('\n✅ Screenshot capture complete!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);

  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
  } finally {
    await context.close();
  }
}

// Run
captureScreenshots().catch(console.error);
