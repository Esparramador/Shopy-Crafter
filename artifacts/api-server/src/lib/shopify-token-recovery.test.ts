import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: { update: mocks.update },
  projectsTable: { id: "id", accessToken: "access_token", tokenExpiresAt: "token_expires_at" },
}));
vi.mock("drizzle-orm", () => ({ eq: (...args: unknown[]) => args }));
vi.mock("./crypto.js", () => ({
  encrypt: (token: string) => `encrypted:${token}`,
  safeDecrypt: (value: string | null | undefined) => value?.startsWith("encrypted:") ? value.slice("encrypted:".length) : null,
}));
vi.mock("./logger.js", () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: mocks.loggerError, debug: vi.fn() },
}));

const { refreshToken, validateTokenDetailed, getRecentShopifyTokenFailure } = await import("./shopify.js");

const shop = "example.myshopify.com";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mocks.update.mockReset();
  mocks.set.mockReset();
  mocks.where.mockReset();
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: mocks.where });
  mocks.where.mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllGlobals());

describe("Shopify token recovery", () => {
  it("classifies Shopify's 403 verification page as access verification, not bad credentials", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("<html><title>Verifying your connection...</title></html>", {
      status: 403,
      headers: { "content-type": "text/html" },
    }));

    await expect(refreshToken(41, shop, "client-id", "client-secret")).rejects.toMatchObject({
      name: "ShopifyAuthError",
      shopifyStatus: 403,
      failureKind: "verification_required",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("classifies a 404 unavailable shop and leaves the saved token untouched", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("<html><title>Shop 404</title>store unavailable</html>", {
      status: 404,
      headers: { "content-type": "text/html" },
    }));

    await expect(refreshToken(42, shop, "client-id", "client-secret")).rejects.toMatchObject({
      name: "ShopifyAuthError",
      shopifyStatus: 404,
      failureKind: "store_unavailable",
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(getRecentShopifyTokenFailure(42)).toMatchObject({ failureKind: "store_unavailable", shopifyStatus: 404 });
    await expect(refreshToken(42, shop, "client-id", "client-secret")).rejects.toMatchObject({
      failureKind: "store_unavailable",
      shopifyStatus: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates simultaneous renewals and stores only the successful new token", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ access_token: "fresh-token", expires_in: 3600 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    const tokens = await Promise.all([
      refreshToken(43, shop, "client-id", "client-secret"),
      refreshToken(43, shop, "client-id", "client-secret"),
    ]);

    expect(tokens).toEqual(["fresh-token", "fresh-token"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: "encrypted:fresh-token",
      tokenExpiresAt: expect.any(Date),
    }));
  });

  it.each([
    [403, "<html>Verifying your connection...</html>", "verification_required"],
    [404, "<html>store unavailable</html>", "store_unavailable"],
    [401, '{"error":"invalid_token"}', "invalid_token"],
  ] as const)("returns a diagnostic validation result for HTTP %i without exposing token contents", async (status, body, failureKind) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { status }));

    const result = await validateTokenDetailed(shop, "sensitive-access-token");

    expect(result).toMatchObject({ valid: false, status, failureKind });
    expect(JSON.stringify(result)).not.toContain("sensitive-access-token");
  });

  it("keeps validateToken-compatible validation results for a successful shop check", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ shop: { id: 1 } }), { status: 200 }));

    await expect(validateTokenDetailed(shop, "existing-token")).resolves.toEqual({ valid: true, status: 200 });
  });
});
