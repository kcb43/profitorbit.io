import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { BarChart3, FileSpreadsheet, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { usePreferences } from '@/lib/usePreferences';
import { getSectionById } from '@/modules/settingsRegistry';
import SettingsSectionLayout from '@/components/settings/SettingsSectionLayout';

const section = getSectionById('reports');

const DATE_RANGES = [
  { value: 'lifetime', label: 'All Time' },
  { value: '365d', label: 'Last 12 Months' },
  { value: '180d', label: 'Last 6 Months' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '30d', label: 'Last 30 Days' },
];

const FORMATS = [
  { value: 'excel', label: 'Excel (.xlsx)' },
  { value: 'pdf', label: 'PDF (print view)' },
  { value: 'csv', label: 'CSV' },
];

export default function ReportsPrefsSettings() {
  const { toast } = useToast();
  const { prefs, updatePrefs, loading } = usePreferences();

  const rp = prefs.reports ?? {};
  const defaultDateRange = rp.defaultDateRange ?? 'lifetime';
  const defaultFormat    = rp.defaultFormat    ?? 'excel';
  const includeFees      = rp.includeFees      ?? true;
  const includeShipping  = rp.includeShipping  ?? true;
  const analyticsRange   = rp.analyticsRange   ?? 'lifetime';

  async function update(patch) {
    await updatePrefs({ reports: patch });
    toast({ title: 'Report preferences saved' });
  }

  return (
    <SettingsSectionLayout section={section}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Report Defaults</CardTitle>
              <CardDescription>Pre-set filters and formats used when you open the Report Builder</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Default date range */}
          <div className="space-y-1.5">
            <Label htmlFor="default-range">Default Date Range</Label>
            <Select
              value={defaultDateRange}
              onValueChange={(v) => update({ defaultDateRange: v })}
              disabled={loading}
            >
              <SelectTrigger id="default-range" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default export format */}
          <div className="space-y-1.5">
            <Label htmlFor="default-format">Default Export Format</Label>
            <Select
              value={defaultFormat}
              onValueChange={(v) => update({ defaultFormat: v })}
              disabled={loading}
            >
              <SelectTrigger id="default-format" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Analytics PDF range */}
          <div className="space-y-1.5">
            <Label htmlFor="analytics-range">Default Analytics PDF Range</Label>
            <p className="text-xs text-muted-foreground">
              Pre-selects the date range when you click Export PDF on Dashboard / Reports pages
            </p>
            <Select
              value={analyticsRange}
              onValueChange={(v) => update({ analyticsRange: v })}
              disabled={loading}
            >
              <SelectTrigger id="analytics-range" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Include/exclude sections */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>What to Include</CardTitle>
              <CardDescription>Toggle columns to include in exported reports by default</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include Platform Fees</Label>
              <p className="text-xs text-muted-foreground">Show fee columns in exports</p>
            </div>
            <Switch
              checked={includeFees}
              onCheckedChange={(v) => update({ includeFees: v })}
              disabled={loading}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include Shipping Costs</Label>
              <p className="text-xs text-muted-foreground">Show shipping columns in exports</p>
            </div>
            <Switch
              checked={includeShipping}
              onCheckedChange={(v) => update({ includeShipping: v })}
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>
    </SettingsSectionLayout>
  );
}
