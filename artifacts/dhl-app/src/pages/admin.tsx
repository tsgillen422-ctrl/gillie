import React from "react";
import {
  useGetMe,
  useGetReports,
  useResolveReport,
  getGetReportsQueryKey,
  useGetAdmins,
  useSearchUsers,
  useSetUserAdmin,
  useGetSuspendedUsers,
  useSetUserSuspension,
  getGetSuspendedUsersQueryKey,
  useGetWaiverAcceptances,
  getGetAdminsQueryKey,
  getSearchUsersQueryKey,
  useGetDemoDataStatus,
  useSeedDemoData,
  useClearDemoData,
  getGetDemoDataStatusQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { ShieldCheck, ShieldAlert, Flag, Trash2, Ban, AlertTriangle, Check, Search, ShieldPlus, ShieldMinus, Crown, FileSignature, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

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

const TARGET_LABELS: Record<string, string> = { post: "Post", user: "User", pin: "Pin", catch: "Catch" };

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
  const overdue =
    isPending &&
    Date.now() - new Date(report.createdAt).getTime() > 24 * 60 * 60 * 1000;

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
        <div className="flex shrink-0 items-center gap-1.5">
          {overdue && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Overdue</Badge>
          )}
          <StatusBadge status={report.status} action={report.action} />
        </div>
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

function MemberRow({
  user,
  myId,
  onToggle,
  pending,
}: {
  user: any;
  myId?: number;
  onToggle: (user: any, makeAdmin: boolean) => void;
  pending: boolean;
}) {
  const isMe = user.id === myId;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <UserAvatar name={user.displayName} username={user.username} avatarUrl={user.avatarUrl} className="w-8 h-8" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/profile/${user.id}`} className="font-medium text-sm hover:underline truncate">
              {user.displayName}
            </Link>
            {user.isAdmin && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500 gap-1 text-[10px] px-1.5 py-0">
                <Crown className="w-3 h-3" /> Admin
              </Badge>
            )}
            {isMe && <span className="text-[10px] text-muted-foreground">(you)</span>}
          </div>
          <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
        </div>
      </div>
      {user.isAdmin ? (
        <Button
          size="sm"
          variant="outline"
          className="text-destructive shrink-0"
          disabled={pending || isMe}
          title={isMe ? "You can't remove your own admin access" : undefined}
          onClick={() => onToggle(user, false)}
        >
          <ShieldMinus className="w-4 h-4" /> Remove admin
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="shrink-0" disabled={pending} onClick={() => onToggle(user, true)}>
          <ShieldPlus className="w-4 h-4" /> Make admin
        </Button>
      )}
    </div>
  );
}

function MembersManager({ enabled, myId }: { enabled: boolean; myId?: number }) {
  const [query, setQuery] = React.useState("");
  const q = query.trim();
  const queryClient = useQueryClient();
  const { data: admins, isLoading: adminsLoading } = useGetAdmins({ query: { enabled } });
  const { data: results, isLoading: searching } = useSearchUsers(
    { q },
    { query: { enabled: enabled && q.length > 0 } }
  );
  const setAdmin = useSetUserAdmin();

  const onToggle = (user: any, makeAdmin: boolean) => {
    setAdmin.mutate(
      { userId: user.id, data: { isAdmin: makeAdmin } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getSearchUsersQueryKey({ q }) });
          toast.success(makeAdmin ? `${user.displayName} is now an admin.` : `Removed admin access from ${user.displayName}.`);
        },
        onError: () => toast.error("Couldn't update admin access."),
      }
    );
  };

  return (
    <div className="space-y-5">
      <Card className="border-border/60">
        <CardHeader className="p-4 pb-2">
          <h2 className="font-semibold text-sm">Add an admin</h2>
          <p className="text-xs text-muted-foreground">Search for a member to grant or revoke admin access.</p>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or username..."
              className="pl-8"
            />
          </div>
          {q.length > 0 && (
            <div className="divide-y divide-border/60">
              {searching ? (
                <div className="py-3 space-y-2">
                  {[0, 1].map((i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
                </div>
              ) : !results || results.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">No members found for "{q}".</p>
              ) : (
                results.map((u: any) => (
                  <MemberRow key={u.id} user={u} myId={myId} onToggle={onToggle} pending={setAdmin.isPending} />
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="p-4 pb-2">
          <h2 className="font-semibold text-sm">Current admins</h2>
          <p className="text-xs text-muted-foreground">Everyone with full admin access.</p>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {adminsLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </div>
          ) : !admins || admins.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No admins yet.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {admins.map((u: any) => (
                <MemberRow key={u.id} user={u} myId={myId} onToggle={onToggle} pending={setAdmin.isPending} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SuspendedManager({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const { data: suspended, isLoading } = useGetSuspendedUsers({ query: { enabled } });
  const setSuspension = useSetUserSuspension();

  const restore = (user: any) => {
    setSuspension.mutate(
      { userId: user.id, data: { suspended: false } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSuspendedUsersQueryKey() });
          toast.success(`Restored ${user.displayName}'s account.`);
        },
        onError: () => toast.error("Couldn't restore that account."),
      }
    );
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="p-4 pb-2">
        <h2 className="font-semibold text-sm">Suspended accounts</h2>
        <p className="text-xs text-muted-foreground">
          Suspended users are blocked from using Gillie. Restore to give them access back.
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
          </div>
        ) : !suspended || suspended.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No suspended accounts.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {suspended.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserAvatar name={u.displayName} username={u.username} avatarUrl={u.avatarUrl} className="w-8 h-8" />
                  <div className="min-w-0">
                    <Link href={`/profile/${u.id}`} className="block truncate font-medium text-sm hover:underline">
                      {u.displayName}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      @{u.username}
                      {u.warningCount > 0 ? ` · ⚠ ${u.warningCount} warning${u.warningCount > 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={setSuspension.isPending}
                  onClick={() => restore(u)}
                >
                  <RotateCcw className="w-4 h-4" /> Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WaiverManager({ enabled }: { enabled: boolean }) {
  const { data: records, isLoading } = useGetWaiverAcceptances({ query: { enabled } });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><FileSignature /></EmptyMedia>
          <EmptyTitle>No acceptances yet</EmptyTitle>
          <EmptyDescription>Waiver agreements will appear here as members accept them.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="p-4 pb-2">
        <h2 className="font-semibold text-sm">Waiver acceptances</h2>
        <p className="text-xs text-muted-foreground">{records.length} record{records.length === 1 ? "" : "s"}, newest first.</p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="divide-y divide-border/60">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar name={r.user.displayName} username={r.user.username} avatarUrl={r.user.avatarUrl ?? undefined} className="w-8 h-8" />
                <div className="min-w-0">
                  <Link href={`/profile/${r.user.id}`} className="font-medium text-sm hover:underline truncate block">
                    {r.user.displayName}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">@{r.user.username}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className="text-[10px] mb-0.5">v{r.version}</Badge>
                <p className="text-[11px] text-muted-foreground">{format(new Date(r.acceptedAt), "PP p")}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DemoDataManager({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetDemoDataStatus({ query: { enabled } });
  const count = status?.demoUserCount ?? 0;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getGetDemoDataStatusQueryKey() });
  const seed = useSeedDemoData();
  const clear = useClearDemoData();

  const onSeed = () => {
    seed.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(res.message ?? "Demo data generated.");
        refresh();
      },
      onError: () => toast.error("Failed to generate demo data."),
    });
  };
  const onClear = () => {
    clear.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(`Removed ${res.removed} demo accounts.`);
        refresh();
      },
      onError: () => toast.error("Failed to remove demo data."),
    });
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="p-4 pb-2">
        <h2 className="font-semibold text-sm">Demo data for App Review</h2>
        <p className="text-xs text-muted-foreground">
          Populate the app with demo boaters, posts, catches and map pins so a
          reviewer (or any new user) sees an active community. New accounts
          automatically follow the demo boaters, and their boats stay live on the
          map. Remove it once review is complete.
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3">
        <div className="text-sm">
          {isLoading ? (
            <Skeleton className="h-5 w-40" />
          ) : count > 0 ? (
            <span className="inline-flex items-center gap-2">
              <Badge variant="secondary">Active</Badge>
              {count} demo accounts on the lake
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Badge variant="outline">Off</Badge>
              No demo data
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={onSeed} disabled={seed.isPending || count > 0}>
            {seed.isPending ? "Generating…" : "Generate demo data"}
          </Button>
          <Button
            variant="outline"
            onClick={onClear}
            disabled={clear.isPending || count === 0}
          >
            {clear.isPending ? "Removing…" : "Remove demo data"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminPage() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const [view, setView] = React.useState<"reports" | "members" | "waivers" | "demo">("reports");
  const [tab, setTab] = React.useState<"pending" | "resolved" | "dismissed" | "all">("pending");
  const statusParam = tab === "all" ? undefined : tab;
  const { data: reports, isLoading } = useGetReports(
    statusParam ? { status: statusParam as any } : undefined,
    { query: { enabled: !!me?.isAdmin && view === "reports" } }
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
          <h1 className="text-xl font-bold">Admin</h1>
          <p className="text-xs text-muted-foreground">Review reports and manage who has admin access.</p>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="waivers">Waivers</TabsTrigger>
          <TabsTrigger value="demo">Demo</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "members" ? (
        <div className="space-y-5">
          <MembersManager enabled={!!me?.isAdmin} myId={me?.id} />
          <SuspendedManager enabled={!!me?.isAdmin} />
        </div>
      ) : view === "waivers" ? (
        <WaiverManager enabled={!!me?.isAdmin} />
      ) : view === "demo" ? (
        <DemoDataManager enabled={!!me?.isAdmin} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
