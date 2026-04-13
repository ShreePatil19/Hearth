"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { Channel } from "@/lib/types";

interface ChannelTogglesProps {
  channels: Channel[];
  communityId: string;
  toggleAction: (formData: FormData) => Promise<void>;
}

export function ChannelToggles({ channels, communityId, toggleAction }: ChannelTogglesProps) {
  const [isPending, startTransition] = useTransition();

  if (channels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No channels found. Try reconnecting your Slack workspace.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {channels.map((channel) => (
        <div
          key={channel.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">#{channel.name}</span>
            {channel.is_private && (
              <Badge variant="outline" className="text-[10px]">Private</Badge>
            )}
            {channel.member_count && (
              <span className="text-xs text-muted-foreground">
                {channel.member_count} members
              </span>
            )}
          </div>
          <form
            action={(formData) => {
              startTransition(() => toggleAction(formData));
            }}
          >
            <input type="hidden" name="communityId" value={communityId} />
            <input type="hidden" name="channelId" value={channel.id} />
            <input type="hidden" name="optedIn" value={channel.opted_in ? "false" : "true"} />
            <Switch
              checked={channel.opted_in}
              disabled={isPending}
              onCheckedChange={() => {
                const fd = new FormData();
                fd.set("communityId", communityId);
                fd.set("channelId", channel.id);
                fd.set("optedIn", channel.opted_in ? "false" : "true");
                startTransition(() => toggleAction(fd));
              }}
            />
          </form>
        </div>
      ))}
    </div>
  );
}
