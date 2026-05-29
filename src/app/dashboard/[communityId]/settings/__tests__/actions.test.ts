import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const COMMUNITY = "11111111-1111-4111-8111-111111111111";
const CHANNEL = "22222222-2222-4222-8222-222222222222";
const OWNER = "owner-1";

type BuildOpts = {
  user?: { id: string } | null;
  authError?: { message: string } | null;
  owner?: string | null; // null => community row missing or owner mismatch
  mutateError?: { message: string } | null;
};

function buildClient(opts: BuildOpts) {
  const single = vi.fn().mockResolvedValue({
    data: opts.owner == null ? null : { owner_user_id: opts.owner },
  });
  const mutateResult = { error: opts.mutateError ?? null };
  const eqChain: Record<string, unknown> = {};
  eqChain.eq = vi.fn(() => eqChain);
  (eqChain as { then?: unknown }).then = (resolve: (r: unknown) => unknown) =>
    Promise.resolve(resolve(mutateResult));
  const update = vi.fn(() => eqChain);

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user === undefined ? { id: OWNER } : opts.user },
        error: opts.authError ?? null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })),
      update,
    })),
    _update: update,
  };
}

function mockModules(client: ReturnType<typeof buildClient>, adminRpcError?: { message: string } | null) {
  const revalidatePath = vi.fn();
  const redirect = vi.fn();
  const rpc = vi.fn().mockResolvedValue({ error: adminRpcError ?? null });
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue(client),
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: vi.fn(() => ({ rpc })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath }));
  vi.doMock("next/navigation", () => ({ redirect }));
  return { revalidatePath, redirect, rpc };
}

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("settings actions", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("@/lib/supabase/admin");
    vi.doUnmock("next/cache");
    vi.doUnmock("next/navigation");
  });

  describe("toggleChannel", () => {
    it("rejects a request missing community or channel IDs", async () => {
      mockModules(buildClient({ user: { id: OWNER }, owner: OWNER }));
      const { toggleChannel } = await import("@/app/dashboard/[communityId]/settings/actions");

      const result = await toggleChannel(null, fd({}));

      expect(result).toEqual({ error: expect.stringMatching(/Invalid request/) });
    });

    it("rejects an unauthenticated caller", async () => {
      mockModules(buildClient({ user: null, owner: OWNER }));
      const { toggleChannel } = await import("@/app/dashboard/[communityId]/settings/actions");

      const result = await toggleChannel(null, fd({ communityId: COMMUNITY, channelId: CHANNEL, optedIn: "true" }));

      expect(result).toEqual({ error: expect.stringMatching(/signed in/i) });
    });

    it("rejects a caller who is not the community owner", async () => {
      mockModules(buildClient({ user: { id: "intruder" }, owner: OWNER }));
      const { toggleChannel } = await import("@/app/dashboard/[communityId]/settings/actions");

      const result = await toggleChannel(null, fd({ communityId: COMMUNITY, channelId: CHANNEL, optedIn: "true" }));

      expect(result).toEqual({ error: expect.stringMatching(/owner/i) });
    });

    it("updates the channel opt-in flag for the owner", async () => {
      const client = buildClient({ user: { id: OWNER }, owner: OWNER });
      const { revalidatePath } = mockModules(client);
      const { toggleChannel } = await import("@/app/dashboard/[communityId]/settings/actions");

      const result = await toggleChannel(null, fd({ communityId: COMMUNITY, channelId: CHANNEL, optedIn: "true" }));

      expect(result).toBeNull();
      expect(client._update).toHaveBeenCalledWith({ opted_in: true });
      expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/${COMMUNITY}/settings`);
    });

    it("surfaces a database error", async () => {
      const client = buildClient({ user: { id: OWNER }, owner: OWNER, mutateError: { message: "boom" } });
      mockModules(client);
      const { toggleChannel } = await import("@/app/dashboard/[communityId]/settings/actions");

      const result = await toggleChannel(null, fd({ communityId: COMMUNITY, channelId: CHANNEL, optedIn: "false" }));

      expect(result).toEqual({ error: expect.stringMatching(/Failed to update channel: boom/) });
    });
  });

  describe("regenerateShareToken", () => {
    it("rejects a missing community ID", async () => {
      mockModules(buildClient({ user: { id: OWNER }, owner: OWNER }));
      const { regenerateShareToken } = await import("@/app/dashboard/[communityId]/settings/actions");

      expect(await regenerateShareToken(null, fd({}))).toEqual({
        error: expect.stringMatching(/community ID missing/),
      });
    });

    it("writes a fresh share token for the owner", async () => {
      const client = buildClient({ user: { id: OWNER }, owner: OWNER });
      mockModules(client);
      const { regenerateShareToken } = await import("@/app/dashboard/[communityId]/settings/actions");

      const result = await regenerateShareToken(null, fd({ communityId: COMMUNITY }));

      expect(result).toBeNull();
      expect(client._update).toHaveBeenCalledWith({ share_token: expect.any(String) });
    });

    it("surfaces a database error", async () => {
      const client = buildClient({ user: { id: OWNER }, owner: OWNER, mutateError: { message: "nope" } });
      mockModules(client);
      const { regenerateShareToken } = await import("@/app/dashboard/[communityId]/settings/actions");

      expect(await regenerateShareToken(null, fd({ communityId: COMMUNITY }))).toEqual({
        error: expect.stringMatching(/Failed to regenerate token: nope/),
      });
    });
  });

  describe("disableSharing", () => {
    it("clears the share token for the owner", async () => {
      const client = buildClient({ user: { id: OWNER }, owner: OWNER });
      mockModules(client);
      const { disableSharing } = await import("@/app/dashboard/[communityId]/settings/actions");

      const result = await disableSharing(null, fd({ communityId: COMMUNITY }));

      expect(result).toBeNull();
      expect(client._update).toHaveBeenCalledWith({ share_token: null });
    });

    it("rejects a missing community ID", async () => {
      mockModules(buildClient({ user: { id: OWNER }, owner: OWNER }));
      const { disableSharing } = await import("@/app/dashboard/[communityId]/settings/actions");

      expect(await disableSharing(null, fd({}))).toEqual({
        error: expect.stringMatching(/community ID missing/),
      });
    });

    it("surfaces a database error", async () => {
      const client = buildClient({ user: { id: OWNER }, owner: OWNER, mutateError: { message: "down" } });
      mockModules(client);
      const { disableSharing } = await import("@/app/dashboard/[communityId]/settings/actions");

      expect(await disableSharing(null, fd({ communityId: COMMUNITY }))).toEqual({
        error: expect.stringMatching(/Failed to disable sharing: down/),
      });
    });
  });

  describe("revokeIntegration", () => {
    it("calls the revoke RPC and redirects to the dashboard", async () => {
      const client = buildClient({ user: { id: OWNER }, owner: OWNER });
      const { rpc, redirect } = mockModules(client);
      const { revokeIntegration } = await import("@/app/dashboard/[communityId]/settings/actions");

      await revokeIntegration(null, fd({ communityId: COMMUNITY }));

      expect(rpc).toHaveBeenCalledWith("revoke_community", { p_community_id: COMMUNITY });
      expect(redirect).toHaveBeenCalledWith("/dashboard");
    });

    it("surfaces an RPC error and does not redirect", async () => {
      const client = buildClient({ user: { id: OWNER }, owner: OWNER });
      const { redirect } = mockModules(client, { message: "rpc failed" });
      const { revokeIntegration } = await import("@/app/dashboard/[communityId]/settings/actions");

      const result = await revokeIntegration(null, fd({ communityId: COMMUNITY }));

      expect(result).toEqual({ error: expect.stringMatching(/Failed to revoke integration: rpc failed/) });
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("requireOwner edge cases", () => {
    it("treats a missing community row as unauthorized", async () => {
      mockModules(buildClient({ user: { id: OWNER }, owner: null }));
      const { regenerateShareToken } = await import("@/app/dashboard/[communityId]/settings/actions");

      expect(await regenerateShareToken(null, fd({ communityId: COMMUNITY }))).toEqual({
        error: expect.stringMatching(/owner/i),
      });
    });
  });
});
