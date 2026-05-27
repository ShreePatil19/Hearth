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
});
