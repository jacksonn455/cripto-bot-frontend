// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveApiUrl } from "./server-env";

const CONFIG_MISSING = "CONFIG_MISSING: API_URL não configurada ou não é https";

describe("resolveApiUrl", () => {
  it("requires an https API_URL in production", () => {
    expect(resolveApiUrl({ VERCEL_ENV: "production", API_URL: "https://krypto.duckdns.org/" })).toBe("https://krypto.duckdns.org");
    expect(() => resolveApiUrl({ VERCEL_ENV: "production" })).toThrow(CONFIG_MISSING);
    expect(() => resolveApiUrl({ VERCEL_ENV: "production", API_URL: "" })).toThrow(CONFIG_MISSING);
    expect(() => resolveApiUrl({ VERCEL_ENV: "production", API_URL: "http://krypto.duckdns.org" })).toThrow(CONFIG_MISSING);
    expect(() => resolveApiUrl({ VERCEL_ENV: "production", API_URL: "https://" })).toThrow(CONFIG_MISSING);
  });

  it("treats an empty API_URL as unset (|| instead of ??)", () => {
    expect(resolveApiUrl({ VERCEL_ENV: "production", API_URL: "", NEXT_PUBLIC_API_URL: "https://bot.example" })).toBe("https://bot.example");
    expect(resolveApiUrl({ API_URL: "", NEXT_PUBLIC_API_URL: "http://bot:9000" })).toBe("http://bot:9000");
  });

  it("keeps the localhost fallback in dev and preview", () => {
    expect(resolveApiUrl({})).toBe("http://localhost:8000");
    expect(resolveApiUrl({ VERCEL_ENV: "preview", API_URL: "" })).toBe("http://localhost:8000");
    expect(resolveApiUrl({ VERCEL_ENV: "development", API_URL: "http://192.168.0.10:8000" })).toBe("http://192.168.0.10:8000");
  });
});
