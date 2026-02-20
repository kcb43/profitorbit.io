/**
 * Report Definition Registry
 * Maps report IDs to their definitions.
 */

import salesSummary    from '../_definitions/salesSummary.js';
import profitByMonth   from '../_definitions/profitByMonth.js';
import inventoryAging  from '../_definitions/inventoryAging.js';
import feesBreakdown   from '../_definitions/feesBreakdown.js';

const definitions = [
  salesSummary,
  profitByMonth,
  inventoryAging,
  feesBreakdown,
];

const registry = new Map(definitions.map((d) => [d.id, d]));

export function getReportDefinition(reportId) {
  return registry.get(reportId) || null;
}

export function getAllReportDefinitions() {
  return definitions;
}

export default registry;
