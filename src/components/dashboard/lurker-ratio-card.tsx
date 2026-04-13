import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, EyeOff } from "lucide-react";

interface LurkerRatioCardProps {
  totalMembers: number;
  activePosters: number;
}

export function LurkerRatioCard({ totalMembers, activePosters }: LurkerRatioCardProps) {
  const lurkers = Math.max(0, totalMembers - activePosters);
  const lurkerPct = totalMembers > 0 ? Math.round((lurkers / totalMembers) * 100) : 0;
  const activePct = 100 - lurkerPct;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Community Engagement</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="h-4 w-full rounded-full bg-gray-100 overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all"
            style={{ width: `${activePct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Users className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider font-medium">Total</span>
            </div>
            <p className="text-lg font-bold">{totalMembers}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider font-medium">Active</span>
            </div>
            <p className="text-lg font-bold text-orange-600">{activePosters}</p>
            <p className="text-[10px] text-muted-foreground">{activePct}%</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <EyeOff className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-wider font-medium">Lurkers</span>
            </div>
            <p className="text-lg font-bold">{lurkers}</p>
            <p className="text-[10px] text-muted-foreground">{lurkerPct}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
