import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listingUploadHintText } from "@/utils/imageUploadStandards";

export default function FAQ() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">FAQ</h1>
            <p className="mt-1 text-sm sm:text-base text-gray-600">
              Answers to common questions about Orben.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Image Upload Standard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p className="text-gray-700">
                {listingUploadHintText()}
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <span className="font-medium">Best results:</span> use bright photos, sharp focus, and show key angles + any flaws.
                </li>
                <li>
                  <span className="font-medium">Phone photos are fine:</span> we’ll automatically compress large images to keep uploads fast.
                </li>
                <li>
                  <span className="font-medium">HEIC/HEIF (iPhone):</span> supported. If an older browser has trouble, switch iPhone Camera to{" "}
                  <span className="font-medium">Settings → Camera → Formats → Most Compatible</span>.
                </li>
                <li>
                  <span className="font-medium">WebP:</span> supported. (Some marketplaces prefer JPG; we can convert when needed.)
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

