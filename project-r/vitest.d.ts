/// <reference types="vitest/globals" />

import type { TestingLibraryMatchers } from "@testing-library/jest-dom/types/matchers";
import type { AxeMatchers } from "vitest-axe/matchers";

// @testing-library/jest-dom augments 'vitest' but Assertion is re-exported from '@vitest/expect'.
// We must augment '@vitest/expect' directly so toHaveClass/toBeInTheDocument etc. are visible
// when using vitest globals (expect is typed as typeof import('vitest')['expect']).
declare module "@vitest/expect" {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<T, void>, AxeMatchers {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, void>,
      AxeMatchers {}
}
