# Testing Suite

This repository now uses a layered test strategy:

- `unit`: pure business logic and helper behavior.
- `integration`: client library behavior against mocked Supabase chains.
- `e2e` (service-level): full meal lifecycle flow through real app data-layer modules.

## Run Commands

- `npm test` - run all tests once.
- `npm run test:watch` - watch mode.
- `npm run test:phase1` - core CRUD + storage + core loop E2E.
- `npm run test:phase5` - AI/photo-analysis sections.
- `npm run test:phase6` - location intelligence sections.
- `npm run test:e2e` - service-level E2E folder only.

## Dev Plan Mapping

### Phase 1: Core Food Logging (CRUD)

- `src/lib/entries.test.js`
  - verifies create/read/update/delete query contracts and user ownership injection.
- `src/lib/storage.test.js`
  - verifies upload path generation, public URL mapping, auth guard, delete behavior.
- `src/e2e/core-food-loop.test.js`
  - verifies end-to-end core loop sequence: photo upload -> create -> list -> detail -> update -> delete.

### Phase 5: AI Dish Detection

- `src/lib/imageUtils.test.js` (existing)
  - EXIF extraction contracts, HEIC detection, resize API shape.
- `src/lib/analysis.test.js`
  - Edge Function invocation payload, timeout handling, error normalization, confidence filtering.

### Phase 6: Location Intelligence

- `src/lib/geo.test.js` (existing)
  - Haversine distance correctness and symmetry.
- `src/lib/places.test.js` (existing)
  - nearby-place matching logic.
- `src/lib/places.client.test.js`
  - Places Edge Function invocation/timeout behavior and places table persistence contracts.
- `src/lib/weather.test.js` (existing)
  - weather parsing and weather-code mapping.

## Optional Browser E2E (when package install works)

If network access is available for npm installs, add browser-level E2E with Playwright:

1. `npm install -D @playwright/test`
2. `npx playwright install`
3. Add browser specs under `e2e/` for login and full UI journey.

The current suite is intentionally dependency-light and runnable in constrained environments.
