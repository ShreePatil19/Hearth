import { Check, X, RotateCcw, Shield, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  approveMember,
  rejectMember,
  reinstateMember,
} from "./actions";

export const metadata = {
  title: "Members · Hearth Admin",
};

type Profile = {
  user_id: string;
  status: "pending" | "approved" | "rejected";
  is_admin: boolean;
  display_name: string | null;
  created_at: string;
  approved_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function MemberRow({
  profile,
  email,
  actions,
}: {
  profile: Profile;
  email: string | undefined;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-card p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          {profile.is_admin ? (
            <Shield className="h-4 w-4 text-hearth-600" />
          ) : (
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{email ?? profile.user_id}</p>
            {profile.is_admin && (
              <Badge variant="outline" className="border-hearth-200 text-hearth-700">
                Admin
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Signed up {formatDate(profile.created_at)}
            {profile.status === "approved" && profile.approved_at && (
              <> &middot; Approved {formatDate(profile.approved_at)}</>
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

export default async function MembersPage() {
  const supabase = await createClient();

  // Profiles via RLS (admin-only sees all)
  const { data: profilesData } = await supabase
    .from("user_profiles")
    .select("user_id, status, is_admin, display_name, created_at, approved_at")
    .order("created_at", { ascending: false });

  const profiles = (profilesData ?? []) as Profile[];

  // Emails via service-role admin client (auth.users isn't queryable via PostgREST otherwise)
  const adminClient = createAdminClient();
  const { data: usersResp } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const emailById = new Map(
    (usersResp?.users ?? []).map((u) => [u.id, u.email ?? undefined])
  );

  const pending = profiles.filter((p) => p.status === "pending");
  const approved = profiles.filter((p) => p.status === "approved");
  const rejected = profiles.filter((p) => p.status === "rejected");

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground">
          Approve or reject signup requests, and review who has access to Hearth.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Pending */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pending review
              <Badge variant="secondary">{pending.length}</Badge>
            </CardTitle>
            <CardDescription>
              Newly signed-up users waiting for admin approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No pending requests.
              </p>
            )}
            {pending.map((profile) => (
              <MemberRow
                key={profile.user_id}
                profile={profile}
                email={emailById.get(profile.user_id)}
                actions={
                  <>
                    <form action={approveMember}>
                      <input type="hidden" name="user_id" value={profile.user_id} />
                      <Button type="submit" size="sm" className="gap-1.5">
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                    </form>
                    <form action={rejectMember}>
                      <input type="hidden" name="user_id" value={profile.user_id} />
                      <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </form>
                  </>
                }
              />
            ))}
          </CardContent>
        </Card>

        {/* Approved */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Approved
              <Badge variant="secondary">{approved.length}</Badge>
            </CardTitle>
            <CardDescription>
              Active members with full access to the gated parts of Hearth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {approved.length === 0 && (
              <p className="text-sm text-muted-foreground">No approved members yet.</p>
            )}
            {approved.map((profile) => (
              <MemberRow
                key={profile.user_id}
                profile={profile}
                email={emailById.get(profile.user_id)}
                actions={
                  !profile.is_admin && (
                    <form action={rejectMember}>
                      <input type="hidden" name="user_id" value={profile.user_id} />
                      <Button type="submit" size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
                        <X className="h-4 w-4" />
                        Revoke
                      </Button>
                    </form>
                  )
                }
              />
            ))}
          </CardContent>
        </Card>

        {/* Rejected */}
        {rejected.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Rejected
                <Badge variant="secondary">{rejected.length}</Badge>
              </CardTitle>
              <CardDescription>
                Users denied access. Can be reinstated to pending for a fresh review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {rejected.map((profile) => (
                <MemberRow
                  key={profile.user_id}
                  profile={profile}
                  email={emailById.get(profile.user_id)}
                  actions={
                    <form action={reinstateMember}>
                      <input type="hidden" name="user_id" value={profile.user_id} />
                      <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                        <RotateCcw className="h-4 w-4" />
                        Move to pending
                      </Button>
                    </form>
                  }
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
