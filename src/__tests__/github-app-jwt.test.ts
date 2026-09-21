import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  createJwt,
  decodeJwtUnsafe,
  type Clock,
  type JwtCrypto,
  type JwtConfig,
} from "@/lib/github/app/jwt";

/**
 * A minimal mock crypto that always succeeds with a deterministic signature.
 * Used for testing JWT structure without real key material.
 */
function createMockCrypto(): JwtCrypto {
  return {
    async importKey(pem: string): Promise<CryptoKey> {
      // Verify the key is a non-empty string (sanity check)
      assert.ok(pem && pem.length > 0, "Mock crypto expects a non-empty PEM");
      return {} as CryptoKey;
    },

    async sign(
      _key: CryptoKey,
      header: string,
      payload: string
    ): Promise<string> {
      // Return a deterministic fake signature
      return "MOCK_SIGNATURE";
    },
  };
}

/**
 * A fixed clock that always returns the same timestamp.
 */
function createFixedClock(seconds: number): Clock {
  return {
    nowSeconds(): number {
      return seconds;
    },
  };
}

describe("JWT generation", () => {
  const mockCrypto = createMockCrypto();
  const fixedClock = createFixedClock(1700000000);
  const validConfig: JwtConfig = {
    appId: 12345,
    privateKey: "-----BEGIN PRIVATE KEY-----\nFAKE_KEY\n-----END PRIVATE KEY-----",
  };

  it("generates a valid JWT with correct structure", async () => {
    const result = await createJwt(validConfig, fixedClock, mockCrypto);

    assert.ok(result.ok, "Should succeed with valid config");
    if (result.ok) {
      const parts = result.jwt.split(".");
      assert.strictEqual(parts.length, 3, "JWT should have 3 parts");
    }
  });

  it("uses ES256 algorithm in header", async () => {
    const result = await createJwt(validConfig, fixedClock, mockCrypto);

    assert.ok(result.ok);
    if (result.ok) {
      const decoded = decodeJwtUnsafe(result.jwt);
      assert.ok(decoded);
      assert.strictEqual(decoded.header.alg, "ES256");
      assert.strictEqual(decoded.header.typ, "JWT");
    }
  });

  it("sets correct issuer claim", async () => {
    const result = await createJwt(validConfig, fixedClock, mockCrypto);

    assert.ok(result.ok);
    if (result.ok) {
      const decoded = decodeJwtUnsafe(result.jwt);
      assert.ok(decoded);
      assert.strictEqual(decoded.payload.iss, "12345");
    }
  });

  it("sets issued-at with clock skew tolerance", async () => {
    const result = await createJwt(validConfig, fixedClock, mockCrypto);

    assert.ok(result.ok);
    if (result.ok) {
      const decoded = decodeJwtUnsafe(result.jwt);
      assert.ok(decoded);
      // iat should be nowSeconds - 30 (clock skew tolerance)
      assert.strictEqual(decoded.payload.iat, 1699999970);
    }
  });

  it("sets expiration to iat + default TTL (600s)", async () => {
    const result = await createJwt(validConfig, fixedClock, mockCrypto);

    assert.ok(result.ok);
    if (result.ok) {
      const decoded = decodeJwtUnsafe(result.jwt);
      assert.ok(decoded);
      // exp should be iat + 600 = 1699999970 + 600 = 1700000570
      assert.strictEqual(decoded.payload.exp, 1700000570);
    }
  });

  it("respects custom TTL", async () => {
    const config: JwtConfig = {
      appId: 12345,
      privateKey: "FAKE_KEY",
      ttlSeconds: 300,
    };
    const result = await createJwt(config, fixedClock, mockCrypto);

    assert.ok(result.ok);
    if (result.ok) {
      const decoded = decodeJwtUnsafe(result.jwt);
      assert.ok(decoded);
      // exp should be iat + 300 = 1699999970 + 300 = 1700000270
      assert.strictEqual(decoded.payload.exp, 1700000270);
    }
  });

  it("handles normalized private key with escaped newlines", async () => {
    const config: JwtConfig = {
      appId: 12345,
      privateKey: "-----BEGIN PRIVATE KEY-----\\nFAKE_KEY\\n-----END PRIVATE KEY-----",
    };
    const result = await createJwt(config, fixedClock, mockCrypto);

    assert.ok(result.ok, "Should succeed with escaped-newline key");
  });
});

describe("JWT generation errors", () => {
  const mockCrypto = createMockCrypto();
  const fixedClock = createFixedClock(1700000000);

  it("returns MISSING_GITHUB_APP_ID when appId is not set", async () => {
    const config: JwtConfig = {
      appId: 0,
      privateKey: "FAKE_KEY",
    };
    const result = await createJwt(config, fixedClock, mockCrypto);

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_GITHUB_APP_ID");
      // Message should not leak any secrets
      assert.ok(!result.error.message.includes("KEY"), "Error should not leak key material");
    }
  });

  it("returns MISSING_GITHUB_APP_ID when appId is negative", async () => {
    const config: JwtConfig = {
      appId: -1,
      privateKey: "FAKE_KEY",
    };
    const result = await createJwt(config, fixedClock, mockCrypto);

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_GITHUB_APP_ID");
    }
  });

  it("returns MISSING_GITHUB_APP_PRIVATE_KEY when key is empty", async () => {
    const config: JwtConfig = {
      appId: 12345,
      privateKey: "",
    };
    const result = await createJwt(config, fixedClock, mockCrypto);

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "MISSING_GITHUB_APP_PRIVATE_KEY");
    }
  });

  it("returns JWT_SIGNING_FAILED when crypto throws", async () => {
    const failingCrypto: JwtCrypto = {
      async importKey(): Promise<CryptoKey> {
        throw new Error("Key import failed");
      },
      async sign(): Promise<string> {
        throw new Error("Should not reach here");
      },
    };

    const config: JwtConfig = {
      appId: 12345,
      privateKey: "FAKE_KEY",
    };
    const result = await createJwt(config, fixedClock, failingCrypto);

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.strictEqual(result.error.code, "JWT_SIGNING_FAILED");
      // Error message should not include the underlying failure details
      assert.ok(
        !result.error.message.includes("Key import failed"),
        "Error should not leak internal details"
      );
    }
  });

  it("never includes private key material in error messages", async () => {
    const failingCrypto: JwtCrypto = {
      async importKey(pem: string): Promise<CryptoKey> {
        throw new Error(`Failed to import: ${pem}`);
      },
      async sign(): Promise<string> {
        throw new Error("Should not reach here");
      },
    };

    const config: JwtConfig = {
      appId: 12345,
      privateKey: "-----BEGIN PRIVATE KEY-----\nSUPER_SECRET_KEY_MATERIAL\n-----END PRIVATE KEY-----",
    };
    const result = await createJwt(config, fixedClock, failingCrypto);

    assert.ok(!result.ok);
    if (!result.ok) {
      assert.ok(
        !result.error.message.includes("SUPER_SECRET"),
        "Error must never include key material"
      );
      assert.ok(
        !result.error.message.includes("PRIVATE KEY"),
        "Error must never include PEM markers"
      );
    }
  });
});

describe("decodeJwtUnsafe", () => {
  it("decodes a well-formed JWT", () => {
    const header = btoa(JSON.stringify({ alg: "ES256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ iss: "123", iat: 100, exp: 700 }));
    const jwt = `${header}.${payload}.fake_sig`;

    const decoded = decodeJwtUnsafe(jwt);
    assert.ok(decoded);
    assert.strictEqual(decoded.header.alg, "ES256");
    assert.strictEqual(decoded.payload.iss, "123");
  });

  it("returns null for malformed JWT", () => {
    assert.strictEqual(decodeJwtUnsafe("not-a-jwt"), null);
    assert.strictEqual(decodeJwtUnsafe("a.b"), null);
    assert.strictEqual(decodeJwtUnsafe("a.b.c.d"), null);
  });

  it("returns null for non-base64 parts", () => {
    assert.strictEqual(decodeJwtUnsafe("!!!.!!!.!!!" ), null);
  });
});
