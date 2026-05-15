"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { promoteMember } from "../actions";

export function PromoteAdminButton({
  userId,
  email,
}: {
  userId: string;
  email: string | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-700"
        >
          <Shield className="h-4 w-4" />
          Make admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote to admin?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{email ?? userId}</span>{" "}
            will be able to approve new members and promote others to admin.
            This action cannot be undone from the UI.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form
            action={async (formData) => {
              await promoteMember(formData);
              setOpen(false);
            }}
          >
            <input type="hidden" name="user_id" value={userId} />
            <Button type="submit" className="gap-1.5 bg-orange-500 hover:bg-orange-600">
              <Shield className="h-4 w-4" />
              Promote
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
