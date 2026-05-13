import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Overview · Hearth Admin",
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "default" | "warning";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <div
          className={
            accent === "warning"
              ? "rounded-md bg-orange-50 p-1.5 text-orange-600"
              : "rounded-md bg-muted p-1.5 text-muted-foreground"
          }
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function AdminOverview() {
  const supabase = await createClient();

  // Members breakdown
  const [
    { count: pendingCount },
    { count: approvedCount },
    { count: rejectedCount },
    { count: adminCount },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected"),
    supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_admin", true),
  ]);

  // Opportunities breakdown
  const [{ count: totalOpps }, { count: activeOpps }] = await Promise.all([
    supabase.from("opportunities").select("*", { count: "exact", head: true }),
    supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  // Recent signups (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentSignups } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Snapshot of Hearth&rsquo;s members and funding catalog.
          </p>
        </div>
        {(pendingCount ?? 0) > 0 && (
          <Link
            href="/admin/members"
            className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100"
          >
            Review {pendingCount} pending
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending review"
          value={pendingCount ?? 0}
          hint={
            (pendingCount ?? 0) > 0
              ? "Waiting on admin approval"
              : "No new requests"
          }
          icon={Clock}
          accent={(pendingCount ?? 0) > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Approved members"
          value={approvedCount ?? 0}
          hint={`${adminCount ?? 0} admin${(adminCount ?? 0) === 1 ? "" : "s"}`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Active opportunities"
          value={activeOpps ?? 0}
          hint={`${totalOpps ?? 0} total in catalog`}
          icon={Sparkles}
        />
        <StatCard
          label="Signups, last 7 days"
          value={recentSignups ?? 0}
          hint="All-time activity"
          icon={UserPlus}
        />
      </div>

      {/* Members breakdown */}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              Members breakdown
            </CardTitle>
            <CardDescription>
              How signups break down across the approval workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow
              label="Pending"
              count={pendingCount ?? 0}
              variant="warning"
            />
            <StatusRow
              label="Approved"
              count={approvedCount ?? 0}
              variant="success"
            />
            <StatusRow
              label="Rejected"
              count={rejectedCount ?? 0}
              variant="muted"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Common admin tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/members"
              className="flex items-center justify-between rounded-md border bg-card p-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Manage members
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              href="/opportunities"
              className="flex items-center justify-between rounded-md border bg-card p-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                View funding radar
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "warning" | "success" | "muted";
}) {
  const styles = {
    warning: "bg-orange-100 text-orange-700",
    success: "bg-emerald-100 text-emerald-700",
    muted: "bg-muted text-muted-foreground",
  }[variant];

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <Badge variant="secondary" className={styles}>
        {count}
      </Badge>
    </div>
  );
}
