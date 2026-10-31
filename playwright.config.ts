import { defineConfig, devices } from '@playwright/test';
const port = Number(process.env.E2E_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Most tests start as returning users; e2e/guide.spec.ts covers the first-visit guide.
    storageState: {
      cookies: [],
      origins: [
        { origin: baseURL, localStorage: [{ name: 'market-maker.guide-seen', value: '1' }] },
      ],
    },
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: {
      HOST: '127.0.0.1',
      PORT: String(port),
      ALLOWED_ORIGINS: baseURL,
      OPENAI_API_KEY: '',
      OPENAI_MODEL: '',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      RUN_STORE: 'local',
      RUN_STORE_PATH: `.local/e2e-${Date.now()}.json`,
    },
    timeout: 30000,
  },
});
