import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { expect } from "vitest";
expect.extend(axeMatchers);
import dotenv from "dotenv";
import path from "path";

// Setup fake-indexeddb for testing Dexie outbox (Story 4.4)
import 'fake-indexeddb/auto';

dotenv.config({ path: path.resolve(__dirname, ".env.local") });
