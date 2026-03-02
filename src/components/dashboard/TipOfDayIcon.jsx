import React, { useState, useEffect } from 'react';
import { Lightbulb } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

const tips = [
  "Remember: Price high, offer low, and flip like you mean it.",
  "The best source is often the one nobody else is looking at.",
  "Clean items sell faster. A little elbow grease goes a long way.",
  "Great photos are your best salesperson. Use natural light.",
  "Patience is a virtue in sourcing, but speed is a key in listing.",
  "Know your numbers. Profit isn't just selling price minus purchase price.",
  "Don't get emotionally attached to your inventory. It's business, not a museum.",
  "A good deal today is better than a perfect deal tomorrow.",
  "Bundle related items to increase the value of your sale.",
  "Always check for flaws and disclose them honestly in your listings.",
  "Cross-list your items on multiple platforms to maximize visibility.",
  "You don't need more inventory. You need more listings.",
  "A reseller's worst enemy isn't competition — it's procrastination.",
  "You don't run a museum. Let items go before they own you.",
  "Don't fall in love with inventory. Fall in love with profit.",
  "Success in reselling is boring — consistent listings beat random sourcing sprees.",
  "Small margins add up. Big margins pay rent.",
  "Stop waiting for the perfect buyer. Price it for the actual buyer.",
  "A pile of unlisted inventory is just a pile of lost money.",
  "If you wouldn't buy it again, list it faster.",
  "You can't control demand, but you can control your price.",
  "The best price isn't the highest — it's the one that sells.",
  "When in doubt, aim for the quick flip. Cash flows, clutter doesn't.",
  "Don't race to the bottom — race to sell smarter.",
  "Check comps, not your feelings.",
  "Your price is a strategy, not a guess.",
  "The first offer tells you everything about your pricing.",
  "Leave 'em a little meat on the bone — profit is a two-way street.",
  "If everyone else is overpriced, congratulations — you win.",
  "Test pricing weekly. Markets move, and so should you.",
  "Source like a sniper, not a vacuum.",
  "If you can't explain why it'll sell, put it back.",
  "The best deals are found by showing up when others don't.",
  "Good sellers take risks. Great sellers take calculated ones.",
  "Leave your emotions at the thrift door. Take only the profit home.",
  "One good source beats ten mediocre ones.",
  "Buy less trash; find more treasure.",
  "Your eyes should look for profit, not just cool items.",
  "A solid niche beats endless randomness.",
  "The best item is the one you understand how to sell.",
  "Listing speed is your superpower.",
  "Photos sell the item. Your description sells the buyer.",
  "Keep your titles clean. Buyers search, not read poetry.",
  "One listing a day beats ten panic listings once a week.",
  "Build systems, not chaos.",
  "Your workflow should feel like a routine, not a war.",
  "Drafts today are sales tomorrow.",
  "The more you list, the more you sell — the algorithm isn't shy about it.",
  "Your camera is your best employee — treat it right.",
  "Don't overthink descriptions. Overthink profits.",
  "Fast shipping turns watchers into future buyers.",
  "Good packaging is cheap insurance.",
  "Returns happen. Build it into your mindset, not your stress.",
  "Buyers aren't annoying — they're paying your bills.",
  "Your job isn't to win arguments. Your job is to make money.",
  "Pack it like it's worth double what you sold it for.",
  "Respond fast. Slow messages lose sales.",
  "Buyers scroll fast — grab their attention faster.",
  "Clear communication = fewer problems.",
  "Repeat buyers are built through reliability, not luck.",
];

export default function TipOfDayIcon({ className = '' }) {
  const [tip, setTip] = useState('');

  useEffect(() => {
    setTip(tips[Math.floor(Math.random() * tips.length)]);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 ${className}`}
          title="Tip of the Day"
        >
          <Lightbulb className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground mb-1">Tip of the Day</p>
            <p className="text-xs text-muted-foreground leading-relaxed">"{tip}"</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
