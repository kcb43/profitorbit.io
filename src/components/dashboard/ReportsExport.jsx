import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ReportsExport({ sales, totalProfit, totalSales }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const handleExportCSV = () => {
    // TODO: Implement CSV export
    console.log('Export CSV clicked');
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log('Export PDF clicked');
  };

  return (
    <Card className="border-0 shadow-sm bg-white dark:bg-card h-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
          <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Reports & Exports
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Quick Downloads</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="flex items-center gap-2 text-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              CSV Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="flex items-center gap-2 text-xs"
            >
              <FileText className="w-4 h-4" />
              PDF Report
            </Button>
          </div>
        </div>

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
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              View Full Reports →
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

