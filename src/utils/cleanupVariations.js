// Cleanup script for localStorage
// Run this once to remove old variation switcher data

// Remove old variation preference (no longer needed with hybrid approach)
localStorage.removeItem('inventory_view_variation');

console.log('✅ Cleaned up old variation data from localStorage');
console.log('📱 Hybrid variations now apply automatically based on:');
console.log('  - Desktop Grid: V1 (Compact Professional)');
console.log('  - Desktop List: V2 (Visual Showcase)');
console.log('  - Mobile: V2 (Visual Showcase)');
