/**
 * Mercari Category Parser
 * Extracts category hierarchy from Mercari's HTML
 * 
 * Usage:
 * 1. Go to Mercari category page
 * 2. Copy the HTML for the category list
 * 3. Paste it into the html variable below
 * 4. Run: node scripts/parse-mercari-categories.js
 * 5. Copy the output and paste into MERCARI_CATEGORIES in CrosslistComposer.jsx
 */

const fs = require('fs');
const path = require('path');

// Paste your HTML here
const html = `
PASTE_HTML_HERE
`;

// Extract categories using regex
function parseCategories(html) {
  const categories = {};
  
  // Pattern for L1 categories (main subcategories)
  const l1Pattern = /data-testid="L1CategoryRow"\s+data-categoryid="(\d+)"\s+href="[^"]+"><div[^>]*><[^>]*>([^<]+)</g;
  
  // Pattern for L2 categories (sub-subcategories)
  const l2Pattern = /data-testid="L2CategoryRow"\s+data-categoryid="(\d+)"\s+href="[^"]+"><div[^>]*><span[^>]*>([^<]+)</g;
  
  let match;
  
  // Extract L1 categories
  while ((match = l1Pattern.exec(html)) !== null) {
    const id = match[1];
    const name = match[2].replace(/&amp;/g, '&').trim();
    
    if (!categories[id]) {
      categories[id] = {
        id,
        name,
        subcategories: {}
      };
    }
  }
  
  // Extract L2 categories and associate with parent
  // This is simplified - in reality we'd need to parse the HTML structure
  // to determine parent-child relationships
  const l2Matches = [];
  while ((match = l2Pattern.exec(html)) !== null) {
    const id = match[1];
    const name = match[2].replace(/&amp;/g, '&').trim();
    l2Matches.push({ id, name });
  }
  
  console.log('Found L1 categories:', Object.keys(categories).length);
  console.log('Found L2 categories:', l2Matches.length);
  
  return { categories, l2Matches };
}

// Format as JavaScript object
function formatAsJS(data) {
  const { categories, l2Matches } = data;
  
  let output = '// Parsed from Mercari HTML\n';
  output += '{\n';
  
  // Format L1 categories
  Object.values(categories).forEach((cat, index) => {
    output += `  "${cat.id}": {\n`;
    output += `    id: "${cat.id}",\n`;
    output += `    name: "${cat.name}",\n`;
    
    if (Object.keys(cat.subcategories).length > 0) {
      output += `    subcategories: {\n`;
      Object.values(cat.subcategories).forEach((sub, subIndex) => {
        output += `      "${sub.id}": { id: "${sub.id}", name: "${sub.name}" }`;
        output += subIndex < Object.keys(cat.subcategories).length - 1 ? ',\n' : '\n';
      });
      output += `    }\n`;
    }
    
    output += `  }`;
    output += index < Object.keys(categories).length - 1 ? ',\n' : '\n';
  });
  
  output += '}\n\n';
  output += '// L2 categories (need manual parent assignment):\n';
  output += '// ' + JSON.stringify(l2Matches, null, 2);
  
  return output;
}

// Simple extraction for quick parsing
function simpleExtract(html) {
  const results = {
    l1: [],
    l2: []
  };
  
  // Extract all L1 categories
  const l1Regex = /data-testid="L1CategoryRow"\s+data-categoryid="(\d+)"[^>]*>[^]*?<span[^>]*>([^<]+)<\/span>/g;
  let match;
  
  while ((match = l1Regex.exec(html)) !== null) {
    results.l1.push({
      id: match[1],
      name: match[2].replace(/&amp;/g, '&').trim()
    });
  }
  
  // Extract all L2 categories
  const l2Regex = /data-testid="L2CategoryRow"\s+data-categoryid="(\d+)"[^>]*>[^]*?<span[^>]*>([^<]+)<\/span>/g;
  
  while ((match = l2Regex.exec(html)) !== null) {
    results.l2.push({
      id: match[1],
      name: match[2].replace(/&amp;/g, '&').trim()
    });
  }
  
  return results;
}

// Main
console.log('Parsing Mercari categories...\n');

const extracted = simpleExtract(html);

console.log('\n=== L1 CATEGORIES (Main Subcategories) ===');
extracted.l1.forEach(cat => {
  console.log(`"${cat.id}": { id: "${cat.id}", name: "${cat.name}" },`);
});

console.log('\n=== L2 CATEGORIES (Sub-subcategories) ===');
console.log('Note: These need to be manually assigned to their L1 parents\n');
extracted.l2.forEach(cat => {
  console.log(`"${cat.id}": { id: "${cat.id}", name: "${cat.name}" },`);
});

console.log('\n=== SUMMARY ===');
console.log(`Found ${extracted.l1.length} L1 categories`);
console.log(`Found ${extracted.l2.length} L2 categories`);
console.log('\nCopy the output above and organize into your MERCARI_CATEGORIES object!');

