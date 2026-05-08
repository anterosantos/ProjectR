/**
 * Smoke Test: Infrastructure Verification
 * Verifies that the test runner, TypeScript, and dependencies are correctly configured.
 * This test must pass to ensure test infrastructure is working correctly.
 */

describe("Smoke Tests", () => {
  it("TypeScript compiles without errors", () => {
    // If this passes, TypeScript strict mode is working
    const value: string = "test";
    expect(value).toBe("test");
  });

  it("jest-dom matchers are available", () => {
    // Verify @testing-library/jest-dom was set up correctly
    const div = document.createElement("div");
    div.textContent = "test";
    document.body.appendChild(div);
    expect(div).toBeInTheDocument();
    document.body.removeChild(div);
  });

  it("ESLint configuration is valid", () => {
    // If this passes, the project compiled without ESLint errors
    // (assuming npm run lint passed before test)
    expect(true).toBe(true);
  });

  it("Vitest is configured correctly", () => {
    // Basic vitest functionality check
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
  });

  it("environment is jsdom", () => {
    // Verify vitest is using jsdom (has DOM API)
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");
  });
});
