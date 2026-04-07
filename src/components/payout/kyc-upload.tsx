"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileText, ImageIcon, LinkIcon, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { uploadKYCDocument } from "@/actions/payout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const COMPRESSION_THRESHOLD = 5 * 1024 * 1024;

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function compressImageIfNeeded(file: File) {
  if (!file.type.startsWith("image/") || file.size <= COMPRESSION_THRESHOLD) {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    const maxWidth = 1800;
    const scale = Math.min(1, maxWidth / image.width);
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );

    if (!blob) {
      return file;
    }

    const extension = file.name.includes(".") ? ".jpg" : "";
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + extension, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

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
    setUploadProgress(100);
    onSuccess?.();
  }, [onSuccess, state?.success]);

  useEffect(() => {
    if (!state?.error) {
      return;
    }

    toast.error(state.error);
    setUploadProgress(0);
  }, [state?.error]);

  useEffect(() => {
    if (!isPending) {
      return;
    }

    setUploadProgress((current) => (current < 10 ? 10 : current));
    const interval = window.setInterval(() => {
      setUploadProgress((current) => (current >= 92 ? current : current + 12));
    }, 250);

    return () => window.clearInterval(interval);
  }, [isPending]);

  async function submitSelectedFile() {
    if (!selectedFile) {
      toast.error("Please choose a KYC document to upload.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error("KYC document must be 10MB or smaller.");
      return;
    }

    try {
      setIsCompressing(true);
      setUploadProgress(12);
      const processedFile = await compressImageIfNeeded(selectedFile);
      const formData = new FormData();
      formData.set("user_id", userId);
      formData.set("document_type", documentType);
      formData.set("kyc_document", processedFile, processedFile.name);
      setUploadProgress(35);

      startTransition(() => {
        formAction(formData);
      });
    } catch {
      toast.error("We couldn't prepare your file. Please try another image or PDF.");
      setUploadProgress(0);
    } finally {
      setIsCompressing(false);
    }
  }

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
        void submitSelectedFile();
      }}
      ref={formRef}
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

      <div className="grid gap-4 md:grid-cols-3">
        {[
          "National ID front",
          "Driver's License front",
          "Passport photo page",
        ].map((example) => (
          <div
            key={example}
            className="rounded-2xl border border-brand-navy/10 bg-brand-light p-4"
          >
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-brand-steel/30 bg-white text-brand-steel">
              <ShieldCheck className="size-8" />
            </div>
            <p className="mt-3 text-sm font-medium text-brand-navy">{example}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-brand-navy/10 bg-white p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Upload tips</p>
        <ul className="mt-2 space-y-1">
          <li>Ensure all corners are visible with no glare.</li>
          <li>Use a clear, readable image or PDF.</li>
          <li>On mobile, you can use your camera to capture the document directly.</li>
        </ul>
      </div>

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
          capture="environment"
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

      {(isPending || isCompressing || uploadProgress > 0) && !isVerified ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{isCompressing ? "Optimizing file..." : "Uploading document..."}</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      ) : null}

      <Button
        className="w-full bg-brand-navy text-white hover:bg-brand-steel"
        disabled={isPending || isCompressing}
        type="submit"
      >
        {isPending || isCompressing ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {isCompressing ? "Preparing..." : "Uploading..."}
          </>
        ) : (
          "Upload KYC Document"
        )}
      </Button>

      {state?.error && selectedFile ? (
        <Button
          className="w-full border-brand-navy text-brand-navy hover:bg-brand-light"
          onClick={() => void submitSelectedFile()}
          type="button"
          variant="outline"
        >
          <RefreshCcw className="size-4" />
          Retry Upload
        </Button>
      ) : null}
    </form>
  );
}
