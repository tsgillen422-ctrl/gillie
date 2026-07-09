import React from "react";
import { useCreateReport } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

export type ReportTargetType = "post" | "user" | "pin" | "catch";

const REASONS: Record<ReportTargetType, { value: string; label: string }[]> = {
  post: [
    { value: "spam", label: "Spam" },
    { value: "harassment", label: "Harassment" },
    { value: "inappropriate", label: "Inappropriate content" },
    { value: "false_information", label: "False information" },
    { value: "illegal", label: "Illegal activity" },
    { value: "other", label: "Other" },
  ],
  user: [
    { value: "spam", label: "Spam" },
    { value: "harassment", label: "Harassment" },
    { value: "inappropriate", label: "Inappropriate content" },
    { value: "impersonation", label: "Impersonation" },
    { value: "other", label: "Other" },
  ],
  pin: [
    { value: "incorrect_location", label: "Incorrect location" },
    { value: "duplicate", label: "Duplicate pin" },
    { value: "unsafe_information", label: "Unsafe information" },
    { value: "inappropriate", label: "Inappropriate content" },
  ],
  catch: [
    { value: "spam", label: "Spam" },
    { value: "harassment", label: "Harassment" },
    { value: "inappropriate", label: "Inappropriate content" },
    { value: "false_information", label: "False information" },
    { value: "illegal", label: "Illegal activity" },
    { value: "other", label: "Other" },
  ],
};

const TITLES: Record<ReportTargetType, string> = {
  post: "Report Post",
  user: "Report User",
  pin: "Report Pin",
  catch: "Report Catch",
};

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: number;
}) {
  const [reason, setReason] = React.useState("");
  const [details, setDetails] = React.useState("");
  const createReport = useCreateReport();

  React.useEffect(() => {
    if (open) {
      setReason("");
      setDetails("");
    }
  }, [open]);

  const submit = () => {
    if (!reason) {
      toast.error("Please choose a reason.");
      return;
    }
    createReport.mutate(
      {
        data: {
          targetType,
          targetId,
          reason,
          details: details.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Report submitted. Thanks for helping keep the lake safe.");
          onOpenChange(false);
        },
        onError: () => toast.error("Couldn't submit your report. Please try again."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLES[targetType]}</DialogTitle>
          <DialogDescription>
            Tell us what's wrong. Your report is anonymous and will be reviewed by a moderator.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-1">
            {REASONS[targetType].map((r) => (
              <Label
                key={r.value}
                htmlFor={`report-${r.value}`}
                className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2.5 cursor-pointer hover-elevate"
              >
                <RadioGroupItem value={r.value} id={`report-${r.value}`} />
                <span className="text-sm font-normal">{r.label}</span>
              </Label>
            ))}
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor="report-details" className="text-xs text-muted-foreground">
              Additional details (optional)
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add any context that will help us review this report…"
              maxLength={1000}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={createReport.isPending}>
            {createReport.isPending ? "Submitting…" : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
