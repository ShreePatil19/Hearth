"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CohortRow {
  cohort_week: string;
  week_start: string;
  retained_count: number;
  total_in_cohort: number;
}

interface CohortRetentionTableProps {
  data: CohortRow[];
}

function getRetentionColor(pct: number): string {
  if (pct >= 80) return "bg-orange-500 text-white";
  if (pct >= 60) return "bg-orange-400 text-white";
  if (pct >= 40) return "bg-orange-300 text-orange-900";
  if (pct >= 20) return "bg-orange-200 text-orange-800";
  if (pct > 0) return "bg-orange-100 text-orange-700";
  return "bg-gray-50 text-gray-400";
}

export function CohortRetentionTable({ data }: CohortRetentionTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cohort Retention</CardTitle>
        </CardHeader>
        <CardContent className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          Need at least 2 weeks of data for retention analysis
        </CardContent>
      </Card>
    );
  }

  // Group by cohort week
  const cohorts: Record<string, { total: number; weeks: Record<string, number> }> = {};
  for (const row of data) {
    if (!cohorts[row.cohort_week]) {
      cohorts[row.cohort_week] = { total: row.total_in_cohort, weeks: {} };
    }
    cohorts[row.cohort_week].weeks[row.week_start] = row.retained_count;
  }

  const cohortWeeks = Object.keys(cohorts).sort().slice(-8); // Last 8 cohorts
  const allWeeksSet: string[] = [];
  for (const r of data) {
    if (!allWeeksSet.includes(r.week_start)) allWeeksSet.push(r.week_start);
  }
  const allWeeks = allWeeksSet.sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Cohort Retention</CardTitle>
        <p className="text-xs text-muted-foreground">
          Week-over-week retention by cohort (first active week)
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left p-1.5 font-medium text-muted-foreground">Cohort</th>
              <th className="text-center p-1.5 font-medium text-muted-foreground">Size</th>
              {cohortWeeks.length > 0 &&
                Array.from({ length: Math.min(8, allWeeks.length) }, (_, i) => (
                  <th key={i} className="text-center p-1.5 font-medium text-muted-foreground">
                    W{i}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {cohortWeeks.map((cohortWeek) => {
              const cohort = cohorts[cohortWeek];
              const weekEntries = Object.entries(cohort.weeks).sort(([a], [b]) => a.localeCompare(b));

              return (
                <tr key={cohortWeek}>
                  <td className="p-1.5 font-medium whitespace-nowrap">
                    {new Date(cohortWeek).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </td>
                  <td className="text-center p-1.5 text-muted-foreground">{cohort.total}</td>
                  {weekEntries.slice(0, 8).map(([week, count]) => {
                    const pct = cohort.total > 0 ? Math.round((count / cohort.total) * 100) : 0;
                    return (
                      <td key={`${cohortWeek}-${week}`} className="p-1">
                        <div
                          className={`rounded px-2 py-1 text-center font-medium ${getRetentionColor(pct)}`}
                          title={`${count}/${cohort.total} (${pct}%)`}
                        >
                          {pct}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
