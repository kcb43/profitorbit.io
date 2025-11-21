import React, { useState } from "react";
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

  const handleFileChange = (event) => {
    setError("");
    const selected = event.target.files?.[0];
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.type.startsWith("image/") && !selected.type.includes("pdf")) {
      setError("Please upload an image or PDF receipt.");
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleScan = () => {
    if (!file) {
      setError("Upload a receipt image or PDF before scanning.");
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
            Upload a receipt image (JPG, PNG, HEIC) or PDF to auto-fill inventory
            details using your receipt scanning service. This is a placeholder until
            you connect a real OCR provider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receipt-upload">Receipt image or PDF</Label>
            <Input
              id="receipt-upload"
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              disabled={isScanning}
            />
            <p className="text-xs text-muted-foreground">
              Supported: JPG, PNG, HEIC, PDF. Max size 10MB (enforced by provider).
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



