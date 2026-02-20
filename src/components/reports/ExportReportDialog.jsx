import React, { useState, useCallback } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Package,
  DollarSign,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase';

// ─── Report catalogue (mirrors server-side definitions) ───────────────────────

const REPORTS = [
  {
    id: 'sales-summary',
    title: 'Sales Summary',
    description: 'Every sale with price, fees, shipping, cost, and net profit.',
    icon: DollarSign,
    color: 'emerald',
    filters: ['dateRange', 'marketplace'],
  },
  {
    id: 'profit-by-month',
    title: 'Profit by Month',
    description: 'Month-over-month revenue, fees, costs, and net profit.',
    icon: TrendingUp,
    color: 'violet',
    filters: ['dateRange', 'marketplace'],
  },
  {
    id: 'inventory-aging',
    title: 'Inventory Aging',
    description: 'Active inventory items showing how long each has been sitting unsold.',
    icon: Package,
    color: 'amber',
    filters: ['ageBucket', 'status'],
  },
  {
    id: 'fees-breakdown',
    title: 'Fees Breakdown',
    description: 'Platform fees and shipping costs grouped by marketplace.',
    icon: BarChart3,
    color: 'blue',
    filters: ['dateRange', 'marketplace'],
  },
];

const MARKETPLACES = [
  { value: '', label: 'All platforms' },
  { value: 'ebay', label: 'eBay' },
  { value: 'mercari', label: 'Mercari' },
  { value: 'facebook_marketplace', label: 'Facebook Marketplace' },
  { value: 'poshmark', label: 'Poshmark' },
  { value: 'etsy', label: 'Etsy' },
];

const AGE_BUCKETS = [
  { value: '', label: 'All ages' },
  { value: '30', label: '0–30 days' },
  { value: '60', label: '31–60 days' },
  { value: '90', label: '61–90 days' },
  { value: '90+', label: '90+ days' },
];

const STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'listed', label: 'Listed' },
  { value: '', label: 'All statuses' },
];

const COLOR_CLASSES = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  violet:  'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',
  amber:   'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  blue:    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
};

// ─── Helper: run a report and return the runId ────────────────────────────────

async function apiRunReport({ reportId, filters }) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/reports/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(session?.user?.id ? { 'x-user-id': session.user.id } : {}),
    },
    body: JSON.stringify({ reportId, filters }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json(); // { runId, status, rowCount, metrics, preview }
}

// ─── Filters form ─────────────────────────────────────────────────────────────

function FiltersForm({ report, filters, onChange }) {
  const needs = report?.filters || [];
  return (
    <div className="space-y-3">
      {needs.includes('dateRange') && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">From date</Label>
            <Input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">To date</Label>
            <Input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })}
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>
      )}
      {needs.includes('marketplace') && (
        <div>
          <Label className="text-xs">Platform</Label>
          <Select value={filters.marketplace || ''} onValueChange={(v) => onChange({ ...filters, marketplace: v })}>
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              {MARKETPLACES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {needs.includes('ageBucket') && (
        <div>
          <Label className="text-xs">Age bucket</Label>
          <Select value={filters.ageBucket || ''} onValueChange={(v) => onChange({ ...filters, ageBucket: v })}>
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue placeholder="All ages" />
            </SelectTrigger>
            <SelectContent>
              {AGE_BUCKETS.map((b) => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {needs.includes('status') && (
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={filters.status || 'available'} onValueChange={(v) => onChange({ ...filters, status: v })}>
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export default function ExportReportDialog({ open, onClose, defaultReportId = 'sales-summary' }) {
  const [selectedId, setSelectedId]   = useState(defaultReportId);
  const [filters, setFilters]         = useState({ dateFrom: null, dateTo: null, marketplace: '', status: 'available' });
  const [phase, setPhase]             = useState('select'); // select | running | done | error
  const [runResult, setRunResult]     = useState(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const [downloading, setDownloading] = useState(''); // 'excel' | 'pdf' | ''

  const selectedReport = REPORTS.find((r) => r.id === selectedId);

  function reset() {
    setPhase('select');
    setRunResult(null);
    setErrorMsg('');
    setDownloading('');
  }

  async function handleRun() {
    setPhase('running');
    setErrorMsg('');
    try {
      const result = await apiRunReport({ reportId: selectedId, filters });
      setRunResult(result);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  }

  async function handleExcel() {
    if (!runResult?.runId) return;
    setDownloading('excel');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(session?.user?.id ? { 'x-user-id': session.user.id } : {}),
      };
      const res = await fetch(`/api/reports/runs/${runResult.runId}/excel`, { headers });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${selectedId}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel download error:', err);
    } finally {
      setDownloading('');
    }
  }

  async function handlePdf() {
    if (!runResult?.runId) return;
    setDownloading('pdf');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const url = `/api/reports/runs/${runResult.runId}/pdf?token=${encodeURIComponent(token)}`;
      window.open(url, '_blank', 'noopener');
    } finally {
      setDownloading('');
    }
  }

  // Also support the old CSV export path for backwards compat
  async function handleCsv() {
    const { openAuthExport } = await import('@/utils/exportWithAuth');
    const params = {};
    if (filters.dateFrom) params.from = filters.dateFrom;
    if (filters.dateTo)   params.to = filters.dateTo;
    if (filters.marketplace) params.platform = filters.marketplace;
    openAuthExport('/api/sales/export', params);
  }

  function handleClose() {
    reset();
    onClose?.();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            Export Report
          </DialogTitle>
          <DialogDescription>
            Choose a report type, set filters, and download as Excel or PDF.
          </DialogDescription>
        </DialogHeader>

        {/* ── Phase: Select + configure ── */}
        {(phase === 'select' || phase === 'error') && (
          <div className="space-y-5 pt-1">
            {/* Report picker */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Report type
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {REPORTS.map((r) => {
                  const Icon = r.icon;
                  const isSelected = selectedId === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        'flex items-start gap-2.5 text-left rounded-xl border p-3 transition-all',
                        isSelected
                          ? `border-2 ${COLOR_CLASSES[r.color]} ring-1 ring-${r.color}-500/20`
                          : 'border-border hover:border-border/80 hover:bg-muted/30'
                      )}
                    >
                      <div className={cn('rounded-lg p-1.5 flex-shrink-0 mt-0.5', isSelected ? COLOR_CLASSES[r.color] : 'bg-muted text-muted-foreground')}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold leading-tight">{r.title}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{r.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filters */}
            {selectedReport && (
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Filters
                </Label>
                <FiltersForm report={selectedReport} filters={filters} onChange={setFilters} />
              </div>
            )}

            {/* Error message */}
            {phase === 'error' && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button onClick={handleRun} className="flex-1 gap-2">
                <BarChart3 className="w-4 h-4" />
                Run Report
              </Button>
              <Button variant="outline" onClick={handleCsv} className="gap-2">
                CSV
              </Button>
            </div>
          </div>
        )}

        {/* ── Phase: Running ── */}
        {phase === 'running' && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div className="text-center">
              <p className="font-medium">Building your report…</p>
              <p className="text-sm text-muted-foreground mt-1">Fetching and aggregating data</p>
            </div>
          </div>
        )}

        {/* ── Phase: Done ── */}
        {phase === 'done' && runResult && (
          <div className="space-y-4 pt-1">
            {/* Success summary */}
            <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Report ready</p>
                <p className="text-xs text-muted-foreground">
                  {runResult.rowCount?.toLocaleString()} row{runResult.rowCount !== 1 ? 's' : ''} · {selectedReport?.title}
                </p>
              </div>
            </div>

            {/* Metrics preview */}
            {runResult.metrics && Object.keys(runResult.metrics).length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(runResult.metrics).slice(0, 4).map(([key, val]) => (
                  <div key={key} className="bg-muted/40 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {key.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm font-semibold mt-0.5">
                      {typeof val === 'number'
                        ? (key.includes('margin') || key.includes('rate')
                            ? `${val.toFixed(1)}%`
                            : key.includes('avg') || key.includes('gross') || key.includes('net') || key.includes('cost') || key.includes('fee') || key.includes('profit') || key.includes('revenue') || key.includes('shipping')
                              ? `$${val.toFixed(2)}`
                              : val.toLocaleString())
                        : String(val)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Download buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleExcel}
                disabled={downloading === 'excel'}
                className="gap-2"
              >
                {downloading === 'excel' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                )}
                Download Excel
              </Button>
              <Button
                variant="outline"
                onClick={handlePdf}
                disabled={downloading === 'pdf'}
                className="gap-2"
              >
                {downloading === 'pdf' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 text-rose-500" />
                )}
                Open PDF View
              </Button>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              Excel: up to 50,000 rows · PDF: first 500 rows (printable)
            </div>

            <Button variant="ghost" size="sm" onClick={reset} className="w-full">
              Run another report
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
