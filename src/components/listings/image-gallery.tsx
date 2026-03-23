"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface ImageGalleryProps {
  images: string[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-3xl border border-border/70 bg-muted text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <ImageIcon className="size-10" />
          <p className="text-sm">No images available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
        <div className="aspect-[4/3] bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`Listing image ${activeIndex + 1}`}
            className="h-full w-full object-cover"
            src={activeImage}
          />
        </div>
      </div>

      {images.length > 1 ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              className={cn(
                "shrink-0 overflow-hidden rounded-2xl border transition-all",
                index === activeIndex
                  ? "border-primary shadow-sm"
                  : "border-border/70 opacity-80 hover:opacity-100",
              )}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`Thumbnail ${index + 1}`}
                className="h-20 w-28 object-cover"
                src={image}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
