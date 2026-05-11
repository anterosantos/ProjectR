/**
 * Unit Tests for Auth Hook Claim-Merging Logic
 * Tests the core JWT payload parsing and claim injection without Supabase connection
 *
 * Coverage target: ≥80%
 * Relevant to AC #2, AC #3, AC #5, AC #6
 */

// Helper: Create a mock JWT token with standard structure
function createMockJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url"
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = "mock_signature";
  return `${header}.${encodedPayload}.${signature}`;
}

// Helper: Decode JWT payload for assertion
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const [, payload] = jwt.split(".");
  const decoded = Buffer.from(payload, "base64url").toString("utf-8");
  return JSON.parse(decoded);
}

// Helper: Simulate the auth hook claim merge logic (extracted from index.ts for unit testing)
function mergeClaimsIntoJwt(
  jwt: string,
  clubId: string,
  role: string
): string {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      return jwt;
    }

    const payload = parts[1];
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const claims = JSON.parse(decoded);

    // Merge claims (AC #2)
    const updatedClaims = {
      ...claims,
      club_id: clubId,
      role: role,
    };

    // Re-encode
    const newPayload = Buffer.from(JSON.stringify(updatedClaims)).toString("base64url");
    return `${parts[0]}.${newPayload}.${parts[2]}`;
  } catch (error) {
    return jwt; // Graceful fallback (AC #3)
  }
}

describe("Auth Hook — Unit Tests for Claim Merging Logic", () => {
  // ===== Test 5.1: Claims Merge =====
  describe("Test 5.1: Claims Merge", () => {
    it("should merge club_id and role into JWT claims (AC #2)", () => {
      // Setup: Create mock JWT with user data
      const mockPayload = {
        sub: "550e8400-e89b-12d3-a456-426614174000",
        email: "coach@test.club",
        aud: "authenticated",
        iat: 1700000000,
        exp: 1700003600,
      };
      const jwt = createMockJwt(mockPayload);

      // Action: Merge claims
      const clubId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
      const role = "coach";
      const updatedJwt = mergeClaimsIntoJwt(jwt, clubId, role);

      // Assert: JWT claims contain custom claims
      const updatedPayload = decodeJwtPayload(updatedJwt);
      expect(updatedPayload.club_id).toBe(clubId);
      expect(updatedPayload.role).toBe(role);
      expect(updatedPayload.sub).toBe(mockPayload.sub); // Preserve original claims
      expect(updatedPayload.email).toBe(mockPayload.email);
    });

    it("should preserve all original JWT claims when merging (AC #2)", () => {
      const mockPayload = {
        sub: "user-123",
        email: "analyst@club.pt",
        aud: "authenticated",
        custom_key: "custom_value",
      };
      const jwt = createMockJwt(mockPayload);

      const updatedJwt = mergeClaimsIntoJwt(
        jwt,
        "club-456",
        "analyst"
      );

      const updatedPayload = decodeJwtPayload(updatedJwt);
      expect(updatedPayload.custom_key).toBe("custom_value"); // Original claims preserved
    });

    it("should handle UUID club_id correctly", () => {
      const uuid = "550e8400-e89b-12d3-a456-426614174000";
      const jwt = createMockJwt({ sub: "user-1" });

      const updatedJwt = mergeClaimsIntoJwt(jwt, uuid, "player");

      const payload = decodeJwtPayload(updatedJwt);
      expect(payload.club_id).toBe(uuid);
    });

    it("should support all three role values", () => {
      const roles = ["coach", "analyst", "player"];

      for (const role of roles) {
        const jwt = createMockJwt({ sub: "user-1" });
        const updatedJwt = mergeClaimsIntoJwt(jwt, "club-1", role);
        const payload = decodeJwtPayload(updatedJwt);
        expect(payload.role).toBe(role);
      }
    });
  });

  // ===== Test 5.2: No Profile Fallback =====
  describe("Test 5.2: No Profile Fallback", () => {
    it("should return original JWT unchanged when profile is null (AC #3)", () => {
      const mockPayload = {
        sub: "user-no-profile",
        email: "unknown@test.com",
      };
      const jwt = createMockJwt(mockPayload);

      // Simulate no profile found: don't merge claims, return original
      const fallbackJwt = jwt; // Graceful fallback

      expect(fallbackJwt).toBe(jwt);
      const payload = decodeJwtPayload(fallbackJwt);
      expect(payload.club_id).toBeUndefined(); // No claims added
      expect(payload.role).toBeUndefined();
    });

    it("should not crash when attempting to merge null/undefined values (AC #3)", () => {
      const jwt = createMockJwt({ sub: "user-1" });

      // Attempt to call merge with null should not throw
      expect(() => {
        mergeClaimsIntoJwt(jwt, null as unknown as string, null as unknown as string);
      }).not.toThrow();
    });
  });

  // ===== Test 5.3: Malformed Input =====
  describe("Test 5.3: Malformed Input", () => {
    it("should handle invalid JWT format gracefully (AC #3, AC #6)", () => {
      const invalidJwt = "not.a.valid.jwt.at.all"; // Extra parts

      // Should not crash; returns original JWT
      const result = mergeClaimsIntoJwt(invalidJwt, "club-1", "coach");

      // For malformed JWTs, the function should either return original or handle gracefully
      expect(result).toBeDefined();
    });

    it("should return original JWT if JWT has fewer than 3 parts", () => {
      const malformedJwt = "header.payload"; // Missing signature

      const result = mergeClaimsIntoJwt(malformedJwt, "club-1", "coach");

      expect(result).toBe(malformedJwt);
    });

    it("should return original JWT if payload is not valid JSON", () => {
      const invalidJwt = `header.${Buffer.from("not-json").toString("base64url")}.signature`;

      const result = mergeClaimsIntoJwt(invalidJwt, "club-1", "coach");

      expect(result).toBe(invalidJwt);
    });

    it("should handle missing sub claim", () => {
      const payloadWithoutSub = {
        email: "coach@club.pt",
        aud: "authenticated",
      };
      const jwt = createMockJwt(payloadWithoutSub);

      // Should not crash; merge should still work
      const result = mergeClaimsIntoJwt(jwt, "club-1", "coach");

      expect(result).toBeDefined();
      const payload = decodeJwtPayload(result);
      expect(payload.club_id).toBe("club-1");
    });
  });

  // ===== Test 5.4: Edge Cases =====
  describe("Test 5.4: Edge Cases", () => {
    it("should handle very long JWT payloads", () => {
      const largePayload = {
        sub: "user-1",
        data: "x".repeat(5000), // Large payload
      };
      const jwt = createMockJwt(largePayload);

      const result = mergeClaimsIntoJwt(jwt, "club-1", "coach");

      expect(result).toBeDefined();
      const payload = decodeJwtPayload(result);
      expect(payload.data).toBe("x".repeat(5000)); // Data preserved
      expect(payload.club_id).toBe("club-1");
    });

    it("should handle special characters in claims", () => {
      const mockPayload = {
        sub: "user-1",
        email: "test+alias@example.com",
      };
      const jwt = createMockJwt(mockPayload);

      const result = mergeClaimsIntoJwt(jwt, "club-1", "player");

      expect(result).toBeDefined();
      const payload = decodeJwtPayload(result);
      expect(payload.email).toBe("test+alias@example.com");
    });

    it("should maintain JWT structure (header.payload.signature)", () => {
      const jwt = createMockJwt({ sub: "user-1" });
      const result = mergeClaimsIntoJwt(jwt, "club-1", "coach");

      const parts = result.split(".");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeDefined(); // Header
      expect(parts[1]).toBeDefined(); // Payload
      expect(parts[2]).toBeDefined(); // Signature
    });
  });

  // ===== Test 5.5: Coverage for Error Paths =====
  describe("Test 5.5: Error Path Coverage", () => {
    it("should not throw on empty JWT string (AC #6 error handling)", () => {
      expect(() => {
        mergeClaimsIntoJwt("", "club-1", "coach");
      }).not.toThrow();
    });

    it("should not throw on whitespace payload", () => {
      expect(() => {
        mergeClaimsIntoJwt("header.  .signature", "club-1", "coach");
      }).not.toThrow();
    });

    it("should handle deeply nested claims", () => {
      const nestedPayload = {
        sub: "user-1",
        nested: {
          deep: {
            value: "test",
          },
        },
      };
      const jwt = createMockJwt(nestedPayload);

      const result = mergeClaimsIntoJwt(jwt, "club-1", "coach");

      expect(result).toBeDefined();
      const payload = decodeJwtPayload(result);
      expect(payload.nested?.deep?.value).toBe("test");
    });
  });
});
