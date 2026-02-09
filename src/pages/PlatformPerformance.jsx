import React from "react";
import { supabase } from "@/api/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PlatformComparison from "../components/reports/PlatformComparison";

const RANGE_OPTIONS = [
  { label: "90D", value: "90d", helper: "Last 90 days" },
  { label: "180D", value: "180d", helper: "Past 6 months" },
  { label: "12M", value: "365d", helper: "Trailing 12 months" },
  { label: "All", value: "lifetime", helper: "All-time performance" },
];

const RANGE_LABELS = {
  "90d": "90 days",
  "180d": "180 days",
  "365d": "12 months",
  "lifetime": "lifetime",
};

export default function PlatformPerformance() {
  const navigate = useNavigate();
  const [range, setRange] = React.useState("lifetime");

  async function apiGetJson(path) {
    let session = null;
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await supabase.auth.getSession();
      session = res?.data?.session || null;
      if (session?.access_token) break;
      // eslint-disable-next-line no-await-in-loop
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
    queryKey: ["reports", "summary", range],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('range', range);
      return apiGetJson(`/api/reports/summary?${qs.toString()}`);
    },
    placeholderData: null,
  });

  const rangeLabel = RANGE_LABELS[range] ?? "lifetime";
  const hasData = Boolean(reportSummary?.totals?.salesCount);

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Dashboard"))}
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Platform Performance</h1>
            <p className="text-muted-foreground mt-1">Compare marketplace analytics and performance metrics</p>
          </div>
        </div>

        {/* Time Range Filter */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b bg-card">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <CardTitle className="text-lg">Time Range</CardTitle>
                <CardDescription>Select a period to analyze platform performance</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${
                        range === opt.value
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }
                    `}
                    title={opt.helper}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Platform Comparison */}
        {isLoading ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">Loading platform data...</p>
            </CardContent>
          </Card>
        ) : !hasData ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No sales data found for the selected period</p>
              <p className="text-sm text-muted-foreground mt-2">
                Try selecting a different time range or add your first sale
              </p>
            </CardContent>
          </Card>
        ) : (
          <PlatformComparison
            sales={[]} 
            platforms={reportSummary?.platforms || []}
            range={rangeLabel}
          />
        )}
      </div>
    </div>
  );
}
