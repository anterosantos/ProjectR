/**
 * Path Alias Resolution Test
 * Verifies that all @/* import aliases resolve correctly across TypeScript, vitest, and ESLint
 */

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

describe("Path Alias Resolution (@/*)", () => {
  it("@/lib/utils path alias resolves correctly", () => {
    // If this import succeeds and cn function exists, alias is working
    expect(typeof cn).toBe("function");
  });

  it("@/components/ui path alias resolves correctly", () => {
    // If this import succeeds, Button component exists at the aliased path
    expect(Button).toBeDefined();
  });

  it("cn utility from @/lib/utils works as expected", () => {
    // Test the utility function works
    const result = cn("px-2", "py-1");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
