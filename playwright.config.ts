import { defineConfig, devices } from '@playwright/test';

const PORT = 3210;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Every test holds a live WebGL context. Running them concurrently starves
  // the GPU and produces timeouts unrelated to what's being tested, so these
  // run one at a time — slower, but the results mean something.
  fullyParallel: false,
  workers: 1,
  // Serialised WebGL means a multi-item test legitimately runs past Playwright's
  // 30s default, especially on the mobile viewport. Budget for it once here
  // rather than sprinkling test.slow() over individual files.
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // build once, then serve — tests should exercise the production bundle.
    // E2E_DEV=1 skips the build for fast local loops, at the cost of running
    // against StrictMode double-rendered effects.
    command: process.env.E2E_DEV
      ? `npx next dev -p ${PORT}`
      : `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // mounts SceneProbe so tests can inspect geometry inside the WebGL canvas
    env: { NEXT_PUBLIC_E2E: '1' },
  },
});
