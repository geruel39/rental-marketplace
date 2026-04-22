"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DocumentViewerModalProps {
  signedUrl: string;
  documentType: string;
  onClose: () => void;
}

export function DocumentViewerModal({
  signedUrl,
  documentType,
  onClose,
}: DocumentViewerModalProps) {
  const [zoom, setZoom] = useState(1);

  const isPdf = useMemo(() => {
    const normalized = documentType.toLowerCase();
    return normalized.includes("pdf") || signedUrl.toLowerCase().includes(".pdf");
  }, [documentType, signedUrl]);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{documentType}</DialogTitle>
          <DialogDescription>
            Review the submitted verification document before making a decision.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-muted/20 p-3">
          {isPdf ? (
            <iframe
              className="h-[65vh] w-full rounded-lg bg-white"
              src={signedUrl}
              title={documentType}
            />
          ) : (
            <div className="flex min-h-[50vh] items-start justify-center overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={documentType}
                className="max-w-none rounded-lg"
                src={signedUrl}
                style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
              />
            </div>
          )}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            {!isPdf ? (
              <>
                <Button
                  disabled={zoom <= 0.5}
                  onClick={() => setZoom((current) => Math.max(0.5, current - 0.25))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Minus className="size-4" />
                  Zoom Out
                </Button>
                <Button
                  disabled={zoom >= 3}
                  onClick={() => setZoom((current) => Math.min(3, current + 0.25))}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="size-4" />
                  Zoom In
                </Button>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={signedUrl} rel="noreferrer" target="_blank">
                <ExternalLink className="size-4" />
                Open in New Tab
              </a>
            </Button>
            <Button onClick={onClose} size="sm" type="button">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
