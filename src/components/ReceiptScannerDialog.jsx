import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, Scan } from "lucide-react";

export default function ReceiptScannerDialog({
  open,
  onOpenChange,
  onScan,
  isScanning,
}) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const lastAutoScannedNameRef = useRef("");

  const handleFileChange = (event) => {
    setError("");
    const selected = event.target.files?.[0];
    if (!selected) {
      setFile(null);
      return;
    }
    // V1: images only (OpenAI Vision expects images). PDFs can be supported later by rasterizing.
    if (!selected.type.startsWith("image/")) {
      setError("Please upload a receipt image (JPG, PNG, HEIC). PDFs are not supported yet.");
      setFile(null);
      return;
    }
    setFile(selected);

    // Auto-scan immediately after selecting a file (prevents the “nothing happens” flow).
    if (!isScanning && open) {
      const key = `${selected.name}:${selected.size}:${selected.lastModified}`;
      if (lastAutoScannedNameRef.current !== key) {
        lastAutoScannedNameRef.current = key;
        onScan?.(selected);
      }
    }
  };

  const handleScan = () => {
    if (!file) {
      setError("Upload a receipt image before scanning.");
      return;
    }
    setError("");
    onScan?.(file);
  };

  const handleClose = (openState) => {
    if (!openState && isScanning) return; // prevent closing while scanning
    if (!openState) {
      setFile(null);
      setError("");
    }
    onOpenChange?.(openState);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="w-4 h-4" />
            Scan Receipt
          </DialogTitle>
          <DialogDescription>
            Upload a receipt image (JPG, PNG, HEIC) to auto-fill fields like title, total,
            date, and line items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receipt-upload">Receipt image</Label>
            <Input
              id="receipt-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isScanning}
            />
            <p className="text-xs text-muted-foreground">
              Supported: JPG, PNG, HEIC. Tip: if nothing happens after selecting a file,
              try a smaller image.
            </p>
            {file && (
              <div className="text-xs text-muted-foreground">
                Selected: <span className="font-medium">{file.name}</span>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-500" role="alert">
                {error}
              </p>
            )}
          </div>

          {isScanning && (
            <div className="space-y-2">
              <Label>Scanning receipt</Label>
              <Progress value={70} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Contacting receipt OCR service. This can take a few seconds…
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isScanning}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleScan}
            disabled={!file || isScanning}
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            {isScanning ? "Scanning…" : "Scan Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




