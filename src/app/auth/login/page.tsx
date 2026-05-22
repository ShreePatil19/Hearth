import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { GoogleButton } from "@/components/auth/google-button";
import { AuthDivider } from "@/components/auth/auth-divider";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  const raw = params.redirect || "/dashboard";
  const redirectTo =
    raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to your community dashboard
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {params.error && (
          <Alert variant="destructive" className="mb-4">
            {params.error}
          </Alert>
        )}
        {params.message && (
          <Alert className="mb-4 border-success-200 bg-success-50 text-success-800">
            {params.message}
          </Alert>
        )}

        <GoogleButton redirect={redirectTo} />

        <AuthDivider />

        <form action={login} className="space-y-4">
          <input type="hidden" name="redirect" value={redirectTo} />

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
            Sign In
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="font-medium text-hearth-600 hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
