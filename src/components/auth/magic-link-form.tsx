"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function MagicLinkForm({ redirect = "/" }: { redirect?: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
          redirect,
        )}`,
      },
    });

    if (otpError) {
      setError(otpError.message);
    } else {
      setMessage(`Check ${email} for a sign-in link. It expires in 1 hour.`);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <Alert variant="destructive">{error}</Alert>}
      {message && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          {message}
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="magic-email">Email</Label>
        <Input
          id="magic-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>
      <Button type="submit" variant="outline" className="w-full gap-2" disabled={loading}>
        <Mail className="h-4 w-4" />
        {loading ? "Sending…" : "Email me a magic link"}
      </Button>
    </form>
  );
}
