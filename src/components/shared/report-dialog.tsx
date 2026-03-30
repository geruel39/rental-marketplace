"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";

import { submitReport } from "@/actions/reports";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ReportDialog({
  targetType,
  targetId,
  trigger,
}: {
  targetType: "user" | "listing" | "review";
  targetId: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState("spam");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const formData = new FormData();
    formData.set("report_type", reportType);
    formData.set("description", description);

    if (targetType === "user") formData.set("reported_user_id", targetId);
    if (targetType === "listing") formData.set("reported_listing_id", targetId);
    if (targetType === "review") formData.set("reported_review_id", targetId);

    startTransition(async () => {
      const result = await submitReport(formData);
      if (result.success) {
        setOpen(false);
        setDescription("");
        setReportType("spam");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline">
            <Flag className="size-4" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit report</DialogTitle>
          <DialogDescription>
            Tell us what happened and why this content or user should be reviewed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-type">Report type</Label>
            <Select onValueChange={setReportType} value={reportType}>
              <SelectTrigger id="report-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="inappropriate">Inappropriate</SelectItem>
                <SelectItem value="fraud">Fraud</SelectItem>
                <SelectItem value="harassment">Harassment</SelectItem>
                <SelectItem value="misleading">Misleading</SelectItem>
                <SelectItem value="counterfeit">Counterfeit</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-description">Description</Label>
            <Textarea
              id="report-description"
              minLength={10}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Share enough detail for our admins to investigate"
              rows={5}
              value={description}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isPending || description.trim().length < 10}
            onClick={handleSubmit}
            type="button"
          >
            {isPending ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
