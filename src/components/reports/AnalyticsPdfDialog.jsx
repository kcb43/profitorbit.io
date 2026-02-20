/**
 * AnalyticsPdfDialog
 *
 * Compact dialog that lets the user pick a date range, then opens
 * /api/reports/analytics-pdf in a new tab.  The page auto-prints
 * so users can Save as PDF from their browser print dialog.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileText, Loader2, Download } from 'lucide-react';
import { openAuthExport } from '@/utils/exportWithAuth';

const RANGE_OPTIONS = [
  { value: '90d',      label: 'Last 90 Days' },
  { value: '180d',     label: 'Last 6 Months' },
  { value: '365d',     label: 'Last 12 Months' },
  { value: 'lifetime', label: 'All Time' },
  { value: 'custom',   label: 'Custom Range' },
];

export default function AnalyticsPdfDialog({ open, onClose, defaultRange = 'lifetime' }) {
  const [range, setRange]   = useState(defaultRange);
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    try {
      const params = {};
      if (range === 'custom') {
        if (from) params.from = from;
        if (to)   params.to   = to;
      } else {
        params.range = range;
      }
      await openAuthExport('/api/reports/analytics-pdf', params);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setLoading(false);
    onClose?.();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-500" />
            Analytics Report PDF
          </DialogTitle>
          <DialogDescription>
            Generates a business-ready PDF with financials, platforms, categories, and monthly trends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Range pills */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Date Range
            </Label>
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRange(opt.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    range === opt.value
                      ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                      : 'border-border bg-background text-foreground hover:border-sky-400/60 hover:bg-sky-50 dark:hover:bg-sky-900/20'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date pickers */}
          {range === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
            </div>
          )}

          {/* What's included callout */}
          <div className="bg-muted/40 border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">What's in this report:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>KPI summary (revenue, profit, margin, fees, shipping, avg days)</li>
              <li>Platform performance breakdown</li>
              <li>Category breakdown with margins</li>
              <li>Monthly trend (last 12 months)</li>
              <li>Top highlights (best flip, fastest sale, top platform &amp; category)</li>
            </ul>
          </div>

          <p className="text-[11px] text-muted-foreground">
            A new tab will open — use your browser's <strong>Print → Save as PDF</strong> to download.
          </p>

          <Button onClick={handleOpen} disabled={loading} className="w-full gap-2 bg-sky-500 hover:bg-sky-600 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? 'Opening…' : 'Open Analytics PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
