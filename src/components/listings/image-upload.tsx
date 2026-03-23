"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  onFilesChange?: (files: File[]) => void;
}

interface PreviewFile {
  file: File;
  previewUrl: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function ImageUpload({
  value,
  onChange,
  maxImages = 8,
  onFilesChange,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<PreviewFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const emitFilesChange = useEffectEvent((nextFiles: File[]) => {
    onFilesChange?.(nextFiles);
  });

  const totalImages = value.length + files.length;

  useEffect(() => {
    emitFilesChange(files.map((item) => item.file));

    const input = fileInputRef.current;
    if (!input) {
      return;
    }

    const transfer = new DataTransfer();
    files.forEach((item) => transfer.items.add(item.file));
    input.files = transfer.files;
  }, [files]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const previews = useMemo(
    () => [
      ...value.map((url) => ({ type: "existing" as const, url })),
      ...files.map((item) => ({
        type: "new" as const,
        url: item.previewUrl,
        name: item.file.name,
      })),
    ],
    [files, value],
  );

  function addFiles(selectedFiles: File[]) {
    setError(null);

    const availableSlots = maxImages - (value.length + files.length);
    if (availableSlots <= 0) {
      setError(`You can upload up to ${maxImages} images.`);
      return;
    }

    const accepted: PreviewFile[] = [];

    for (const file of selectedFiles) {
      if (!file.type.startsWith("image/")) {
        setError("Only image files are allowed.");
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError("Each image must be 5MB or smaller.");
        continue;
      }

      if (accepted.length >= availableSlots) {
        break;
      }

      accepted.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (accepted.length > 0) {
      setFiles((current) => [...current, ...accepted]);
    }
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    addFiles(selectedFiles);
  }

  function removeExistingImage(url: string) {
    onChange(value.filter((item) => item !== url));
  }

  function removeNewImage(url: string) {
    setFiles((current) => {
      const next = current.filter((item) => item.previewUrl !== url);
      const removed = current.find((item) => item.previewUrl === url);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <button
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20 hover:bg-muted/40",
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
        type="button"
      >
        <ImagePlus className="mb-3 size-8 text-muted-foreground" />
        <p className="font-medium">Drop images here or click to browse</p>
        <p className="mt-2 text-sm text-muted-foreground">
          JPG, PNG, WEBP up to 5MB each
        </p>
      </button>

      <input
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        multiple
        name="images"
        onChange={onInputChange}
        type="file"
      />

      {value.map((url) => (
        <input key={url} name="existing_images" type="hidden" value={url} />
      ))}

      <div className="text-sm text-muted-foreground">
        {totalImages}/{maxImages} images
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {previews.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {previews.map((item) => (
            <div
              key={item.url}
              className="relative overflow-hidden rounded-xl border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Listing preview"
                className="aspect-square w-full object-cover"
                src={item.url}
              />
              <Button
                className="absolute right-2 top-2 rounded-full bg-background/90 shadow-sm"
                onClick={() =>
                  item.type === "existing"
                    ? removeExistingImage(item.url)
                    : removeNewImage(item.url)
                }
                size="icon"
                type="button"
                variant="outline"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
