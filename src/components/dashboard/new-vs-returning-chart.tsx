"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewVsReturningChartProps {
  data: { new: number; returning: number };
}

const COLORS = ["hsl(24, 75%, 48%)", "hsl(24, 60%, 75%)"];

export function NewVsReturningChart({ data }: NewVsReturningChartProps) {
  const total = data.new + data.returning;

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">New vs Returning</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No user data yet
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    { name: "New Users", value: data.new },
    { name: "Returning", value: data.returning },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">New vs Returning</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
