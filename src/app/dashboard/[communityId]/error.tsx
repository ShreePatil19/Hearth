"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CommunityDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md text-center">
        <CardContent className="pt-8 pb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Dashboard Error</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {error.message || "Failed to load dashboard data. Please try again."}
          </p>
          <Button onClick={reset} className="bg-orange-500 hover:bg-orange-600">
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
