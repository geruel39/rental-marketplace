"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FileText, ImageIcon, LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { uploadKYCDocument } from "@/actions/payout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResponse } from "@/types";

type KYCUploadProps = {
  userId: string;
  currentDocumentUrl?: string;
  onSuccess?: () => void;
  isVerified?: boolean;
};

const initialState: ActionResponse | null = null;

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function KYCUpload({
  userId,
  currentDocumentUrl,
  onSuccess,
  isVerified = false,
}: KYCUploadProps) {
  const [state, formAction, isPending] = useActionState(uploadKYCDocument, initialState);
  const [documentType, setDocumentType] = useState("national_id");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const previewUrl = useMemo(() => {
    if (!selectedFile || selectedFile.type === "application/pdf") {
      return null;
    }

    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!state?.success) {
      return;
    }

    toast.success(state.success);
    setSelectedFile(null);
    onSuccess?.();
  }, [onSuccess, state?.success]);

  useEffect(() => {
    if (!state?.error) {
      return;
    }

    toast.error(state.error);
  }, [state?.error]);

  const statusBadge = isVerified
    ? {
        label: "Verified",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      }
    : currentDocumentUrl
      ? {
          label: "Pending Verification",
          className: "border-amber-200 bg-amber-50 text-amber-700",
        }
      : {
          label: "Not Uploaded",
          className: "border-red-200 bg-red-50 text-red-700",
        };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => {
          formAction(formData);
        });
      }}
    >
      <input name="user_id" type="hidden" value={userId} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Badge className={statusBadge.className} variant="secondary">
          {statusBadge.label}
        </Badge>
        {currentDocumentUrl && isVerified ? (
          <a
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-sky transition-colors hover:text-brand-navy"
            href={currentDocumentUrl}
            rel="noreferrer"
            target="_blank"
          >
            <LinkIcon className="size-4" />
            Verified Document
          </a>
        ) : null}
      </div>

      {currentDocumentUrl && !isVerified ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your document is being reviewed. You&apos;ll be notified once verified.
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="document_type">Document Type</Label>
        <Select
          name="document_type"
          onValueChange={setDocumentType}
          value={documentType}
        >
          <SelectTrigger className="w-full bg-white" id="document_type">
            <SelectValue placeholder="Choose document type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="national_id">National ID (recommended)</SelectItem>
            <SelectItem value="drivers_license">Driver&apos;s License</SelectItem>
            <SelectItem value="passport">Passport</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="kyc_document">Upload Document</Label>
        <Input
          accept="image/*,application/pdf"
          id="kyc_document"
          name="kyc_document"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          type="file"
        />
        <p className="text-xs text-muted-foreground">Accepted formats: JPG, PNG, PDF. Max size: 10MB.</p>
      </div>

      {selectedFile ? (
        <div className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4">
          {previewUrl ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="KYC preview"
                className="h-40 w-full rounded-2xl object-cover"
                src={previewUrl}
              />
              <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {selectedFile.type === "application/pdf" ? (
                <FileText className="size-5 text-brand-steel" />
              ) : (
                <ImageIcon className="size-5 text-brand-steel" />
              )}
              <span>
                {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </span>
            </div>
          )}
        </div>
      ) : null}

      <Button
        className="w-full bg-brand-navy text-white hover:bg-brand-steel"
        disabled={isPending}
        type="submit"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Uploading...
          </>
        ) : (
          "Upload KYC Document"
        )}
      </Button>
    </form>
  );
}
