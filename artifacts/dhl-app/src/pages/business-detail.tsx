import React from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  ArrowLeft,
  Store,
  Phone,
  Globe,
  Clock,
  MapPin,
  Navigation,
  Flag,
  Pencil,
  BadgeCheck,
} from "lucide-react";
import { useGetBusiness, useGetMe, useCreateReport } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const REPORT_REASONS = [
  { value: "fake_listing", label: "Fake or fraudulent listing" },
  { value: "incorrect_information", label: "Incorrect information" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

export default function BusinessDetailPage() {
  const [, params] = useRoute("/businesses/:businessId");
  const [, navigate] = useLocation();
  const businessId = Number(params?.businessId);
  const { toast } = useToast();

  const { data: me } = useGetMe();
  const { data: business, isLoading, error } = useGetBusiness(businessId, {
    query: { queryKey: ["business", businessId], enabled: Number.isFinite(businessId) },
  });
  const submitReport = useCreateReport();

  const [reportOpen, setReportOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string>("");
  const [details, setDetails] = React.useState("");

  const isOwner = me != null && business != null && business.userId === me.id;

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (error || !business) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="font-semibold">Business not found</p>
        <Button variant="outline" onClick={() => navigate("/businesses")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Businesses
        </Button>
      </div>
    );
  }

  const handleReport = () => {
    if (!reason) return;
    submitReport.mutate(
      { data: { targetType: "business" as any, targetId: business.id, reason: reason as any, details: details.trim() || undefined } },
      {
        onSuccess: () => {
          setReportOpen(false);
          setReason("");
          setDetails("");
          toast({ title: "Report submitted", description: "Thanks — our moderators will take a look." });
        },
        onError: () => toast({ title: "Could not submit report", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl pb-24">
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 backdrop-blur px-2 py-2 border-b border-border">
          <Button size="icon" variant="ghost" onClick={() => window.history.length > 1 ? window.history.back() : navigate("/businesses")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold truncate flex-1">{business.businessName}</h1>
          {isOwner && (
            <Button size="sm" variant="outline" asChild>
              <Link href="/businesses/me/edit"><Pencil className="w-4 h-4 mr-1.5" />Edit</Link>
            </Button>
          )}
        </div>

        {business.status !== "approved" && (
          <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {business.status === "pending"
              ? "Pending Review — this listing is only visible to you and admins until it's approved."
              : "This listing was not approved. Edit and resubmit for review."}
          </div>
        )}

        {business.photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto p-4 pb-0 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {business.photos.map((p, i) => (
              <img key={i} src={p} alt="" className="h-52 rounded-2xl object-cover snap-center shrink-0 max-w-[85%]" />
            ))}
          </div>
        )}

        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold leading-tight">{business.businessName}</h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <Badge variant="secondary">{business.businessType}</Badge>
                {business.status === "approved" && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    <BadgeCheck className="w-3 h-3 mr-1" /> Verified listing
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {business.description && (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{business.description}</p>
          )}

          <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {business.phone && (
              <a href={`tel:${business.phone}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium">{business.phone}</span>
              </a>
            )}
            {business.website && (
              <a
                href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <Globe className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{business.website}</span>
              </a>
            )}
            {business.hours && (
              <div className="flex items-start gap-3 px-4 py-3">
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-sm whitespace-pre-wrap">{business.hours}</span>
              </div>
            )}
            {business.serviceArea && (
              <div className="flex items-start gap-3 px-4 py-3">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">Service area: {business.serviceArea}</span>
              </div>
            )}
          </div>

          {business.lat != null && business.lng != null && (
            <Button className="w-full" asChild>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${business.lat},${business.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation className="w-4 h-4 mr-2" /> Navigate here
              </a>
            </Button>
          )}

          {!isOwner && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setReportOpen(true)}
              data-testid="button-report-business"
            >
              <Flag className="w-4 h-4 mr-2" /> Report this business
            </Button>
          )}
        </div>
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Report Business</DialogTitle>
            <DialogDescription>
              Report a fake, incorrect, or inappropriate listing. Our moderators will review it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger data-testid="select-report-reason">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Details (optional)</Label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Anything else moderators should know…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!reason || submitReport.isPending}
              onClick={handleReport}
              data-testid="button-submit-report"
            >
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
