import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockUser = { id: string } | null;
type MockProfile = { is_admin: boolean } | null;

function buildSupabaseMock(opts: {
  user: MockUser;
  profile: MockProfile;
  updateError?: { message: string } | null;
}) {
  const eqSpy = vi.fn();
  const updateSpy = vi.fn();

  const eqChain: {
    eq: typeof eqSpy;
    then: (cb: (r: { error: { message: string } | null }) => unknown) => unknown;
  } = {
    eq: eqSpy,
    then: (cb) => cb({ error: opts.updateError ?? null }),
  };
  eqSpy.mockReturnValue(eqChain);
  updateSpy.mockReturnValue(eqChain);

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: opts.user } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== "user_profiles") throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: opts.profile }),
          }),
        }),
        update: updateSpy,
      };
    }),
    _spies: { update: updateSpy, eq: eqSpy },
  };
}

function mockSupabase(client: ReturnType<typeof buildSupabaseMock>) {
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue(client),
  }));
  vi.doMock("next/cache", () => ({
    revalidatePath: vi.fn(),
  }));
}

function makeFormData(userId: string): FormData {
  const fd = new FormData();
  fd.set("user_id", userId);
  return fd;
}

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("promoteMember", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("next/cache");
  });

  it("unauthenticated caller is a no-op (returns error, never calls update)", async () => {
    const client = buildSupabaseMock({ user: null, profile: null });
    mockSupabase(client);
    const { promoteMember } = await import("@/app/admin/members/actions");

    const result = await promoteMember(null, makeFormData(VALID_UUID));

    expect(result).toEqual({ error: expect.stringMatching(/signed in/i) });
    expect(client._spies.update).not.toHaveBeenCalled();
  });

  it("non-admin caller is a no-op (returns error, never calls update)", async () => {
    const client = buildSupabaseMock({
      user: { id: "caller-1" },
      profile: { is_admin: false },
    });
    mockSupabase(client);
    const { promoteMember } = await import("@/app/admin/members/actions");

    const result = await promoteMember(null, makeFormData(VALID_UUID));

    expect(result).toEqual({ error: expect.stringMatching(/admin/i) });
    expect(client._spies.update).not.toHaveBeenCalled();
  });

  it("only promotes users with status='approved' (the eq clause is load-bearing)", async () => {
    const client = buildSupabaseMock({
      user: { id: "caller-1" },
      profile: { is_admin: true },
    });
    mockSupabase(client);
    const { promoteMember } = await import("@/app/admin/members/actions");

    await promoteMember(null, makeFormData(VALID_UUID));

    expect(client._spies.update).toHaveBeenCalledWith({ is_admin: true });
    const eqCalls = client._spies.eq.mock.calls.map((c) => [c[0], c[1]]);
    expect(eqCalls).toEqual(
      expect.arrayContaining([
        ["user_id", VALID_UUID],
        ["status", "approved"],
      ]),
    );
  });

  it("rejects a missing or invalid user ID before touching the database", async () => {
    const client = buildSupabaseMock({ user: { id: "caller-1" }, profile: { is_admin: true } });
    mockSupabase(client);
    const { promoteMember } = await import("@/app/admin/members/actions");

    const result = await promoteMember(null, new FormData());

    expect(result).toEqual({ error: expect.stringMatching(/Missing or invalid user ID/) });
    expect(client._spies.update).not.toHaveBeenCalled();
  });

  it("surfaces a database error from the promote update", async () => {
    const client = buildSupabaseMock({
      user: { id: "caller-1" },
      profile: { is_admin: true },
      updateError: { message: "constraint violation" },
    });
    mockSupabase(client);
    const { promoteMember } = await import("@/app/admin/members/actions");

    const result = await promoteMember(null, makeFormData(VALID_UUID));

    expect(result).toEqual({ error: expect.stringMatching(/Failed to promote member: constraint violation/) });
  });
});

describe("approveMember", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("next/cache");
  });

  it("stamps approved_at/approved_by when an admin approves a member", async () => {
    const client = buildSupabaseMock({ user: { id: "caller-1" }, profile: { is_admin: true } });
    mockSupabase(client);
    const { approveMember } = await import("@/app/admin/members/actions");

    const result = await approveMember(null, makeFormData(VALID_UUID));

    expect(result).toBeNull();
    expect(client._spies.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved", approved_by: "caller-1", approved_at: expect.any(String) }),
    );
  });

  it("returns an error for an unauthenticated caller", async () => {
    const client = buildSupabaseMock({ user: null, profile: null });
    mockSupabase(client);
    const { approveMember } = await import("@/app/admin/members/actions");

    const result = await approveMember(null, makeFormData(VALID_UUID));

    expect(result).toEqual({ error: expect.stringMatching(/signed in/i) });
    expect(client._spies.update).not.toHaveBeenCalled();
  });

  it("returns an error for a non-admin caller", async () => {
    const client = buildSupabaseMock({ user: { id: "caller-1" }, profile: { is_admin: false } });
    mockSupabase(client);
    const { approveMember } = await import("@/app/admin/members/actions");

    const result = await approveMember(null, makeFormData(VALID_UUID));

    expect(result).toEqual({ error: expect.stringMatching(/admin/i) });
    expect(client._spies.update).not.toHaveBeenCalled();
  });

  it("surfaces a database error", async () => {
    const client = buildSupabaseMock({
      user: { id: "caller-1" },
      profile: { is_admin: true },
      updateError: { message: "write failed" },
    });
    mockSupabase(client);
    const { approveMember } = await import("@/app/admin/members/actions");

    const result = await approveMember(null, makeFormData(VALID_UUID));

    expect(result).toEqual({ error: expect.stringMatching(/Failed to update member: write failed/) });
  });
});

describe("rejectMember / reinstateMember", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("next/cache");
  });

  it("rejectMember sets status='rejected' without an approval stamp", async () => {
    const client = buildSupabaseMock({ user: { id: "caller-1" }, profile: { is_admin: true } });
    mockSupabase(client);
    const { rejectMember } = await import("@/app/admin/members/actions");

    const result = await rejectMember(null, makeFormData(VALID_UUID));

    expect(result).toBeNull();
    expect(client._spies.update).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("reinstateMember sets status='pending'", async () => {
    const client = buildSupabaseMock({ user: { id: "caller-1" }, profile: { is_admin: true } });
    mockSupabase(client);
    const { reinstateMember } = await import("@/app/admin/members/actions");

    const result = await reinstateMember(null, makeFormData(VALID_UUID));

    expect(result).toBeNull();
    expect(client._spies.update).toHaveBeenCalledWith({ status: "pending" });
  });

  it("rejectMember rejects a missing user ID", async () => {
    const client = buildSupabaseMock({ user: { id: "caller-1" }, profile: { is_admin: true } });
    mockSupabase(client);
    const { rejectMember } = await import("@/app/admin/members/actions");

    const result = await rejectMember(null, new FormData());

    expect(result).toEqual({ error: expect.stringMatching(/Missing or invalid user ID/) });
    expect(client._spies.update).not.toHaveBeenCalled();
  });
});
