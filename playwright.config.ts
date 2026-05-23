import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { config as loadEnv } from 'dotenv';

// Load .env.local so UAT_* vars are available to Playwright (Next.js loads
// this automatically for the app, but Playwright runs in its own process).
loadEnv({ path: path.join(__dirname, '.env.local') });

/**
 * UAT Playwright configuration for FieldLogicHQ.
 *
 * Assumes the dev server is already running on UAT_BASE_URL (default: http://localhost:3000).
 * Run tests with: npx playwright test --config playwright.config.ts
 *
 * Auth session files are stored in tests/uat/.auth/ so each role logs in once
 * per full suite run (not once per test).
 */

const BASE_URL = process.env.UAT_BASE_URL ?? 'http://localhost:3000';

// Paths to persisted session files, one per role
export const SESSION_FILES = {
  platformAdmin: path.join(__dirname, 'tests/uat/.auth/platform-admin.json'),
  orgOwner:      path.join(__dirname, 'tests/uat/.auth/org-owner.json'),
  orgAdmin:      path.join(__dirname, 'tests/uat/.auth/org-admin.json'),
  coach:         path.join(__dirname, 'tests/uat/.auth/coach.json'),
} as const;

export default defineConfig({
  testDir: './tests/uat',
  testMatch: '**/*.spec.ts',

  // Run tests sequentially — the dev server is single-process and we share auth state
  fullyParallel: false,
  workers: 1,

  // Global timeout per test (ms).
  // Auth-setup tests need extra headroom on first run — Next.js compiles pages
  // on-demand and the platform-admin layout also does a Supabase DB call before
  // redirecting, which can take 20-30 s on a cold dev server.
  timeout: 60_000,

  // Fail the build on CI if any test.only was left behind
  forbidOnly: !!process.env.CI,

  // Retry once on failure to reduce flakiness from hydration timing
  retries: process.env.CI ? 2 : 1,

  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/uat/results/results.json' }],
    ['html',  { outputFolder: 'tests/uat/results/html', open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    // Capture screenshot and trace on every failure
    screenshot: 'only-on-failure',
    trace:      'on-first-retry',
    video:      'off',
    // Where artifacts land
    testIdAttribute: 'data-testid',
  },

  projects: [
    // ── Auth setup project — runs first, persists session files ──────────────
    {
      name: 'auth-setup',
      testMatch: '**/auth.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Main UAT suite — depends on auth setup ───────────────────────────────
    {
      name: 'uat',
      testMatch: '**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Default to org-owner session; individual tests override via fixtures
        storageState: SESSION_FILES.orgOwner,
      },
      dependencies: ['auth-setup'],
    },
  ],
});
