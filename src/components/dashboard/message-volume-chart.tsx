"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MessageVolumeChartProps {
  data: { date: string; messages: number }[];
}

export function MessageVolumeChart({ data }: MessageVolumeChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Message Volume</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No data yet — first sync runs at 2am UTC
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Message Volume</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(24, 75%, 48%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(24, 75%, 48%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(d) => new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(d) => new Date(d as string).toLocaleDateString("en-AU", { day: "numeric", month: "long" })}
            />
            <Area
              type="monotone"
              dataKey="messages"
              stroke="hsl(24, 75%, 48%)"
              fill="url(#msgGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
