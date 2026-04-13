import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Contributor {
  rank: number;
  label: string;
  hashPreview: string;
  messages: number;
}

interface TopContributorsTableProps {
  data: Contributor[];
}

export function TopContributorsTable({ data }: TopContributorsTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top Contributors</CardTitle>
        </CardHeader>
        <CardContent className="h-32 flex items-center justify-center text-muted-foreground text-sm">
          No contributor data yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Top Contributors</CardTitle>
        <p className="text-xs text-muted-foreground">
          Anonymized — no real names or identifiers shown
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Contributor</TableHead>
              <TableHead className="text-right">Messages</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((contributor) => (
              <TableRow key={contributor.rank}>
                <TableCell className="font-medium">{contributor.rank}</TableCell>
                <TableCell>
                  <span className="text-sm">{contributor.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    {contributor.hashPreview}...
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {contributor.messages}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
