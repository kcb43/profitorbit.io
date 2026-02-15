import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hlcwhpajorzbleabavcr.supabase.co',
  'sb_secret_jfF_FPZMZNXkJcAp8da0SA_UcqFHU4-'
);

async function fixPolling() {
  console.log('🔧 Fixing deal source polling configuration...\n');

  // 1. Reset all last_polled_at to NULL so they poll immediately
  const { error: resetError } = await supabase
    .from('deal_sources')
    .update({ last_polled_at: null })
    .eq('enabled', true)
    .eq('type', 'rss');

  if (resetError) {
    console.error('❌ Error resetting last_polled_at:', resetError);
  } else {
    console.log('✅ Reset all last_polled_at to NULL (will poll immediately)');
  }

  // 2. Reduce poll intervals for more frequent updates
  const { error: intervalError } = await supabase
    .from('deal_sources')
    .update({ poll_interval_minutes: 5 })
    .eq('enabled', true)
    .eq('type', 'rss')
    .gte('poll_interval_minutes', 20);

  if (intervalError) {
    console.error('❌ Error updating poll intervals:', intervalError);
  } else {
    console.log('✅ Reduced poll intervals to 5 minutes for all sources');
  }

  // 3. Set Reddit sources to 3 minutes (they're fast)
  const { error: redditError } = await supabase
    .from('deal_sources')
    .update({ poll_interval_minutes: 3 })
    .eq('enabled', true)
    .ilike('name', '%Reddit%');

  if (redditError) {
    console.error('❌ Error updating Reddit intervals:', redditError);
  } else {
    console.log('✅ Set Reddit sources to 3 minute intervals');
  }

  // 4. Verify changes
  const { data: sources, error: verifyError } = await supabase
    .from('deal_sources')
    .select('name, type, enabled, poll_interval_minutes, last_polled_at')
    .eq('enabled', true)
    .eq('type', 'rss')
    .order('poll_interval_minutes', { ascending: true });

  if (verifyError) {
    console.error('❌ Error verifying changes:', verifyError);
  } else {
    console.log('\n📊 Current configuration:');
    console.table(sources.map(s => ({
      name: s.name,
      poll_minutes: s.poll_interval_minutes,
      last_polled: s.last_polled_at || 'READY NOW'
    })));
  }
}

fixPolling().catch(console.error);
