import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImportContent } from "@/pages/Import";

export default function ImportDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle>Import from Marketplaces</DialogTitle>
          <DialogDescription>
            Sync and import listings from your connected marketplaces
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <ImportContent isDialog={true} onClose={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
