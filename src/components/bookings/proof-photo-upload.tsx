"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Camera, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProofPhotoUploadProps {
  label: string;
  description: string;
  maxPhotos?: number;
  onChange: (files: File[]) => void;
  required?: boolean;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function ProofPhotoUpload({
  label,
  description,
  maxPhotos = 5,
  onChange,
  required = false,
}: ProofPhotoUploadProps) {
  const inputId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [touched, setTouched] = useState(false);

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  function validateAndSetFiles(nextFiles: File[]) {
    setTouched(true);

    if (nextFiles.length > maxPhotos) {
      setError(`You can upload at most ${maxPhotos} photos.`);
      return;
    }

    for (const file of nextFiles) {
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed.");
        return;
      }

      if (file.size > MAX_FILE_BYTES) {
        setError("Each photo must be 10MB or smaller.");
        return;
      }
    }

    if (required && nextFiles.length < 1) {
      setError("At least 1 photo is required.");
      return;
    }

    setError(null);
    setFiles(nextFiles);
    onChange(nextFiles);
  }

  function addFiles(incoming: File[]) {
    const unique = new Map<string, File>();
    [...files, ...incoming].forEach((file) => {
      unique.set(`${file.name}-${file.size}-${file.lastModified}`, file);
    });
    validateAndSetFiles(Array.from(unique.values()));
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
          "border-brand-navy/40 hover:border-brand-navy hover:bg-brand-light",
          isDragging && "border-brand-sky ring-2 ring-brand-sky/40",
        )}
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const dropped = Array.from(event.dataTransfer.files);
          if (dropped.length > 0) {
            addFiles(dropped);
          }
        }}
      >
        <Camera className="mb-2 size-6 text-brand-navy" />
        <p className="text-sm font-medium">Click to upload or drag photos here</p>
        <p className="mt-1 text-xs text-muted-foreground">Image files only, up to 10MB each</p>
        <input
          accept="image/*"
          capture="environment"
          className="sr-only"
          id={inputId}
          multiple
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            if (selected.length > 0) {
              addFiles(selected);
            }
          }}
          type="file"
        />
      </label>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {files.length}/{maxPhotos} photos
        </p>
        {files.length > 0 ? (
          <Button
            className="h-7 px-2 text-xs"
            onClick={() => validateAndSetFiles([])}
            type="button"
            variant="ghost"
          >
            Clear
          </Button>
        ) : null}
      </div>

      {previews.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previews.map((preview) => (
            <div className="relative overflow-hidden rounded-lg border" key={preview.url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={preview.file.name}
                className="h-20 w-full object-cover"
                src={preview.url}
              />
              <button
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
                onClick={() =>
                  validateAndSetFiles(
                    files.filter((file) => file !== preview.file),
                  )
                }
                type="button"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : required && touched && files.length < 1 ? (
        <p className="text-xs text-destructive">At least 1 photo is required.</p>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Upload className="size-3.5" />
        Drag and drop supported
      </div>
    </div>
  );
}
