import React, { useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import ExportReportDialog from "../components/reports/ExportReportDialog";
import AnalyticsPdfDialog from "../components/reports/AnalyticsPdfDialog";
import ReportsV1 from "../components/reports/variants/ReportsV1";

const RANGE_LABELS = {
  "90d": "90 days",
  "180d": "180 days",
  "365d": "12 months",
  "lifetime": "lifetime",
};

export default function ReportsPage() {
  const [range, setRange] = React.useState("lifetime");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportReport, setExportReport] = useState('sales-summary');
  const [analyticsPdfOpen, setAnalyticsPdfOpen] = useState(false);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());

  function openExport(reportId = 'sales-summary') {
    setExportReport(reportId);
    setExportOpen(true);
  }

  async function apiGetJson(path) {
    let session = null;
    for (let i = 0; i < 8; i++) {
      const res = await supabase.auth.getSession();
      session = res?.data?.session || null;
      if (session?.access_token) break;
      await new Promise((r) => setTimeout(r, 150));
    }

    const headers = {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(session?.user?.id ? { 'x-user-id': session.user.id } : {}),
    };

    const resp = await fetch(path, { headers });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  const { data: reportSummary, isLoading } = useQuery({
    queryKey: ["reports", "summary", range, taxYear],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('range', range);
      qs.set('taxYear', String(taxYear));
      return apiGetJson(`/api/reports/summary?${qs.toString()}`);
    },
    placeholderData: null,
  });

  const rangeLabel = RANGE_LABELS[range] ?? "lifetime";
  const hasData = Boolean(reportSummary?.totals?.salesCount);

  const metrics = React.useMemo(() => {
    const t = reportSummary?.totals || {};
    return {
      totalProfit: Number(t.totalProfit || 0),
      totalRevenue: Number(t.totalRevenue || 0),
      avgProfit: Number(t.avgProfit || 0),
      profitMargin: Number(t.profitMargin || 0),
      averageSaleSpeed: Number(t.averageSaleSpeed || 0),
    };
  }, [reportSummary]);

  const comparison = React.useMemo(() => {
    return reportSummary?.comparison || null;
  }, [reportSummary]);

  const insights = React.useMemo(() => {
    return reportSummary?.insights || { topPlatform: null, topCategory: null, highestProfitSale: null, fastestSale: null };
  }, [reportSummary]);

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="w-full h-96" />
      </div>
    );
  }

  return (
    <>
      <ReportsV1
        reportSummary={reportSummary}
        range={range}
        setRange={setRange}
        isLoading={isLoading}
        hasData={hasData}
        metrics={metrics}
        comparison={comparison}
        insights={insights}
        rangeLabel={rangeLabel}
        onExportOpen={openExport}
        onAnalyticsPdfOpen={() => setAnalyticsPdfOpen(true)}
        taxYear={taxYear}
        setTaxYear={setTaxYear}
      />

      <ExportReportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultReportId={exportReport}
      />
      <AnalyticsPdfDialog
        open={analyticsPdfOpen}
        onClose={() => setAnalyticsPdfOpen(false)}
        defaultRange={range}
      />
    </>
  );
}
