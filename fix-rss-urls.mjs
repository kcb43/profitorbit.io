import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hlcwhpajorzbleabavcr.supabase.co',
  'sb_secret_jfF_FPZMZNXkJcAp8da0SA_UcqFHU4-'
);

async function fixBrokenRSSUrls() {
  console.log('🔧 Fixing broken RSS URLs...\n');

  const updates = [
    {
      name: 'DealNews',
      newUrl: 'https://www.dealnews.com/?rss=1&sort=time',
      reason: 'Using most recent deals feed'
    },
    {
      name: 'Brads Deals',
      newUrl: 'https://www.bradsdeals.com/shop/feeds/new-deals',
      reason: 'New feed URL structure'
    },
    {
      name: 'Woot',
      newUrl: 'https://api.woot.com/1/sales/current.rss',
      reason: 'Official API RSS endpoint'
    },
    {
      name: 'Wirecutter Deals',
      newUrl: null, // No RSS feed available anymore
      enabled: false,
      reason: 'No public RSS feed available - disabling'
    }
  ];

  for (const update of updates) {
    console.log(`\n📝 Updating ${update.name}...`);
    
    const updateData = update.newUrl 
      ? { rss_url: update.newUrl, fail_count: 0, last_polled_at: null }
      : { enabled: false, fail_count: 0 };

    const { error } = await supabase
      .from('deal_sources')
      .update(updateData)
      .eq('name', update.name);

    if (error) {
      console.error(`❌ Error updating ${update.name}:`, error.message);
    } else {
      console.log(`✅ ${update.name}: ${update.reason}`);
      if (update.newUrl) {
        console.log(`   New URL: ${update.newUrl}`);
      }
    }
  }

  // Verify changes
  console.log('\n\n📊 Verification - Updated Sources:');
  const { data: sources, error: verifyError } = await supabase
    .from('deal_sources')
    .select('name, rss_url, enabled, fail_count')
    .in('name', updates.map(u => u.name))
    .order('name');

  if (verifyError) {
    console.error('❌ Error verifying:', verifyError.message);
  } else {
    console.table(sources);
  }
}

fixBrokenRSSUrls().catch(console.error);
