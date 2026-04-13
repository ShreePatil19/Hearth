import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="container flex-1 py-8 max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-orange-600 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy at Hearth</h1>
        <p className="text-muted-foreground mb-8">
          Plain-English explanation of what we collect, what we don&apos;t, and why.
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-orange-500" />
                What We Collect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Message metadata only:</strong> who messaged (anonymized), when, which channel, message length, whether it was a thread, and whether it had reactions.</p>
              <p><strong>Channel information:</strong> Channel names and member counts for channels you explicitly opt in.</p>
              <p><strong>Community info:</strong> Your Slack workspace name and ID.</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Shield className="h-5 w-5" />
                What We NEVER Collect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-green-900/80">
              <p><strong>Message content:</strong> We never read, store, or process the text of any message. Ever.</p>
              <p><strong>Direct messages:</strong> We have zero access to DMs.</p>
              <p><strong>Files or attachments:</strong> Not accessed or stored.</p>
              <p><strong>Email addresses or real names:</strong> User identities are hashed with a unique per-community key. We cannot reverse the hash.</p>
              <p><strong>Channels you don&apos;t opt in:</strong> Monitoring is OFF by default for every channel.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-orange-500" />
                How We Protect Your Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Encrypted tokens:</strong> Your Slack OAuth token is encrypted at rest using pgcrypto. It never exists in plain text in our database.</p>
              <p><strong>Hashed user IDs:</strong> We use HMAC-SHA256 with a unique salt per community. Cross-community correlation is mathematically impossible.</p>
              <p><strong>Per-channel opt-in:</strong> Every channel starts OFF. You choose exactly which channels to monitor.</p>
              <p><strong>Row-Level Security:</strong> Database-level isolation ensures your data is only accessible to you.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-orange-500" />
                Your Right to Delete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>One-tap revoke:</strong> You can revoke the integration at any time from your dashboard settings.</p>
              <p><strong>Cascade delete:</strong> Revoking permanently deletes ALL data — messages, channels, analytics, tokens, everything. This cannot be undone.</p>
              <p><strong>No backups retained:</strong> Deleted data is gone from our systems.</p>
            </CardContent>
          </Card>

          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">
              Hearth Slack Bot Scopes: channels:read, channels:history, groups:read, groups:history, users:read
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Questions? Reach out at the{" "}
              <a href="https://github.com/ShreePatil19/Hearth" className="text-orange-600 hover:underline">
                GitHub repo
              </a>
              .
            </p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
