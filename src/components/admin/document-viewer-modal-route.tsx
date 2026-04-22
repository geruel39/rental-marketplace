"use client";

import { useRouter } from "next/navigation";

import { DocumentViewerModal } from "@/components/admin/document-viewer-modal";

interface DocumentViewerModalRouteProps {
  closeHref: string;
  documentType: string;
  signedUrl: string;
}

export function DocumentViewerModalRoute({
  closeHref,
  documentType,
  signedUrl,
}: DocumentViewerModalRouteProps) {
  const router = useRouter();

  return (
    <DocumentViewerModal
      documentType={documentType}
      onClose={() => router.replace(closeHref)}
      signedUrl={signedUrl}
    />
  );
}
