import React from "react";
import { useGetMe, useGetReports, useResolveReport, getGetReportsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { ShieldCheck, ShieldAlert, Flag, Trash2, Ban, AlertTriangle, Check } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate: "Inappropriate content",
  false_information: "False information",
  illegal: "Illegal activity",
  impersonation: "Impersonation",
  incorrect_location: "Incorrect location",
  duplicate: "Duplicate pin",
  unsafe_information: "Unsafe information",
  other: "Other",
};

const TARGET_LABELS: Record<string, string> = { post: "Post", user: "User", pin: "Pin" };

function StatusBadge({ status, action }: { status: string; action?: string | null }) {
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
  if (status === "dismissed") return <Badge variant="outline">Dismissed</Badge>;
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Resolved{action ? ` · ${action}` : ""}</Badge>;
}

function ReportCard({ report }: { report: any }) {
  const resolveReport = useResolveReport();
  const queryClient = useQueryClient();
  const isPending = report.status === "pending";
  const owner = report.targetOwner;

  const act = (action: "dismiss" | "remove" | "warn" | "suspend", label: string) => {
    resolveReport.mutate(
      { id: report.id, data: { action } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetReportsQueryKey() });
          toast.success(label);
        },
        onError: () => toast.error("Couldn't apply that action."),
      }
    );
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-3 p-4 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Flag className="w-4 h-4 text-destructive shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{TARGET_LABELS[report.targetType] ?? report.targetType} report</span>
              <Badge variant="outline" className="text-xs">{REASON_LABELS[report.reason] ?? report.reason}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <StatusBadge status={report.status} action={report.action} />
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        {report.targetSummary != null && (
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">Reported content: </span>
            {report.targetSummary}
            {!report.targetExists && <span className="text-xs text-muted-foreground italic"> (already removed)</span>}
          </div>
        )}
        {report.details && (
          <p className="text-sm text-muted-foreground">
            <span className="text-xs font-medium text-foreground">Details: </span>
            {report.details}
          </p>
        )}
        {owner && (
          <div className="flex items-center gap-2">
            <UserAvatar name={owner.displayName} username={owner.username} avatarUrl={owner.avatarUrl} className="w-7 h-7" />
            <div className="text-xs">
              <Link href={`/profile/${owner.id}`} className="font-medium hover:underline">{owner.displayName}</Link>
              <span className="text-muted-foreground"> @{owner.username}</span>
              {owner.warningCount > 0 && <span className="ml-2 text-amber-600">⚠ {owner.warningCount} warning{owner.warningCount > 1 ? "s" : ""}</span>}
              {owner.isSuspended && <span className="ml-2 text-destructive font-medium">Suspended</span>}
            </div>
          </div>
        )}
        {isPending ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => act("dismiss", "Report dismissed.")} disabled={resolveReport.isPending}>
              <Check className="w-4 h-4" /> Dismiss
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => act("remove", "Content removed.")} disabled={resolveReport.isPending}>
              <Trash2 className="w-4 h-4" /> Remove content
            </Button>
            <Button size="sm" variant="outline" className="text-amber-600" onClick={() => act("warn", "User warned.")} disabled={resolveReport.isPending || !owner}>
              <AlertTriangle className="w-4 h-4" /> Warn user
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => act("suspend", "Account suspended.")} disabled={resolveReport.isPending || !owner}>
              <Ban className="w-4 h-4" /> Suspend account
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground pt-1">
            {report.resolvedAt ? `Actioned ${formatDistanceToNow(new Date(report.resolvedAt), { addSuffix: true })}` : "Closed"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminPage() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const [tab, setTab] = React.useState<"pending" | "resolved" | "dismissed" | "all">("pending");
  const statusParam = tab === "all" ? undefined : tab;
  const { data: reports, isLoading } = useGetReports(
    statusParam ? { status: statusParam as any } : undefined,
    { query: { enabled: !!me?.isAdmin } }
  );

  if (!meLoading && !me?.isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ShieldAlert /></EmptyMedia>
            <EmptyTitle>Admins only</EmptyTitle>
            <EmptyDescription>You don't have permission to view the moderation dashboard.</EmptyDescription>
          </EmptyHeader>
          <Link href="/feed"><Button variant="outline">Back to feed</Button></Link>
        </Empty>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Moderation</h1>
          <p className="text-xs text-muted-foreground">Review reports and take action on content and accounts.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      ) : !reports || reports.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Flag /></EmptyMedia>
            <EmptyTitle>Nothing here</EmptyTitle>
            <EmptyDescription>
              {tab === "pending" ? "No reports waiting for review. Nice work." : "No reports in this category."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  );
}
