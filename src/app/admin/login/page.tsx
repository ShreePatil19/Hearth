import Link from "next/link";
import { Flame, Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { GoogleButton } from "@/components/auth/google-button";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { AuthDivider } from "@/components/auth/auth-divider";
import { adminLogin } from "./actions";

export const metadata = {
  title: "Admin sign-in · Hearth",
};

// Public route — gated specifically excluded from the /admin/* middleware match.
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2.5 text-slate-100"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white">
          <Flame className="h-6 w-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight">Hearth</span>
          <span className="text-xs text-slate-400">Admin console</span>
        </div>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
            <Shield className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Admin sign-in</CardTitle>
          <p className="text-sm text-muted-foreground">
            Restricted to Hearth admins. Non-admins will be redirected.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {params.error && (
            <Alert variant="destructive">{params.error}</Alert>
          )}
          {params.message && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              {params.message}
            </Alert>
          )}

          <GoogleButton redirect="/admin" label="Sign in with Google" />

          <AuthDivider />

          {/* Email + password form */}
          <form action={adminLogin} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                name="password"
                type="password"
                placeholder="Your password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              Sign in
            </Button>
          </form>

          <AuthDivider label="or" />

          {/* Magic link */}
          <MagicLinkForm redirect="/admin" />
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-slate-500">
        Not an admin?{" "}
        <Link href="/auth/login" className="text-slate-300 hover:text-white">
          Use the regular sign-in
        </Link>
      </p>
    </div>
  );
}
