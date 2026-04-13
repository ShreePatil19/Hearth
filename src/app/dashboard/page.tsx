import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import Link from "next/link";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: communities } = await supabase
    .from("communities")
    .select("id, name, platform, status, installed_at")
    .eq("owner_user_id", user.id)
    .order("installed_at", { ascending: false });

  // Single community — redirect directly
  if (communities && communities.length === 1) {
    redirect(`/dashboard/${communities[0].id}`);
  }

  return (
    <div className="container max-w-3xl py-10">
      {params.error && (
        <Alert variant="destructive" className="mb-6">
          {params.error}
        </Alert>
      )}

      {!communities || communities.length === 0 ? (
        // Onboarding
        <div className="text-center py-16">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 mb-6">
            <span className="text-3xl">💬</span>
          </div>
          <h1 className="text-3xl font-bold mb-3">Welcome to Hearth</h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Connect your Slack workspace to get privacy-first analytics for your
            women-founder community. We only store metadata — never message content.
          </p>
          <Button size="lg" className="bg-orange-500 hover:bg-orange-600" asChild>
            <a href="/api/slack/install">
              Connect Slack
            </a>
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Takes about 30 seconds. You choose which channels to monitor.
          </p>
        </div>
      ) : (
        // Community picker
        <div>
          <h1 className="text-2xl font-bold mb-6">Your Communities</h1>
          <div className="space-y-3">
            {communities.map((community) => (
              <Card key={community.id} className="hover:shadow-md transition-shadow">
                <Link href={`/dashboard/${community.id}`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg">{community.name}</CardTitle>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground capitalize">
                      {community.platform} &middot; {community.status}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
