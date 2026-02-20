import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, Calendar, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ExportReportDialog from "@/components/reports/ExportReportDialog";

export default function ReportsExport({ sales, totalProfit, totalSales }) {
  const currentYear = new Date().getFullYear();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultReport, setDefaultReport] = useState('sales-summary');

  function openDialog(reportId = 'sales-summary') {
    setDefaultReport(reportId);
    setDialogOpen(true);
  }

  function handleQuickCsv() {
    window.open('/api/sales/export', '_blank');
  }

  return (
    <>
      <Card className="border-0 shadow-sm bg-white dark:bg-card h-full">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Reports &amp; Exports
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-3">
          {/* Quick export buttons */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Quick Downloads</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickCsv}
                className="flex items-center gap-2 text-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                CSV Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDialog('sales-summary')}
                className="flex items-center gap-2 text-xs"
              >
                <FileText className="w-4 h-4" />
                Excel / PDF
              </Button>
            </div>
          </div>

          {/* Report types */}
          <div className="pt-2 border-t border-gray-200 dark:border-border">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Report Builder</p>
            <div className="space-y-1.5">
              {[
                { id: 'sales-summary',   label: 'Sales Summary' },
                { id: 'profit-by-month', label: 'Profit by Month' },
                { id: 'fees-breakdown',  label: 'Fees Breakdown' },
                { id: 'inventory-aging', label: 'Inventory Aging' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => openDialog(r.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-lg text-left hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-3 h-3" />
                    {r.label}
                  </span>
                  <Download className="w-3 h-3 opacity-50" />
                </button>
              ))}
            </div>
          </div>

          {/* Tax report */}
          <div className="pt-2 border-t border-gray-200 dark:border-border">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Tax Reports</p>
            <Link to={createPageUrl("Reports")}>
              <Button
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-start gap-2 text-xs"
              >
                <Calendar className="w-4 h-4" />
                {currentYear} Tax Summary
              </Button>
            </Link>
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-border">
            <Link to={createPageUrl("Reports")}>
              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
                View Full Reports →
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <ExportReportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        defaultReportId={defaultReport}
      />
    </>
  );
}
