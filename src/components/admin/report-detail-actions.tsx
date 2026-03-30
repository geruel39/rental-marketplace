"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { resolveReport, updateReportStatus } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ReportStatus } from "@/types";

export function ReportDetailActions({
  reportId,
  initialStatus,
  initialNotes,
}: {
  reportId: string;
  initialStatus: ReportStatus;
  initialNotes: string | null | undefined;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ReportStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isPending, startTransition] = useTransition();

  function run(task: () => Promise<void>) {
    startTransition(async () => {
      await task();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="report-status">Status</Label>
        <Select onValueChange={(value) => setStatus(value as ReportStatus)} value={status}>
          <SelectTrigger id="report-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="report-notes">Admin notes</Label>
        <Textarea
          id="report-notes"
          onChange={(event) => setNotes(event.target.value)}
          rows={5}
          value={notes}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          disabled={isPending}
          onClick={() => run(async () => { await updateReportStatus(reportId, status, notes); })}
        >
          {isPending ? "Updating..." : "Update"}
        </Button>
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={isPending}
          onClick={() => run(async () => { await resolveReport(reportId, "resolved", notes || "Resolved by admin"); })}
          type="button"
        >
          Resolve
        </Button>
        <Button
          disabled={isPending}
          onClick={() => run(async () => { await resolveReport(reportId, "dismissed", notes || "Dismissed by admin"); })}
          type="button"
          variant="outline"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
