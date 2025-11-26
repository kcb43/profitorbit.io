import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Lightbulb, Plus, Package, Layers, BarChart3 } from "lucide-react";

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
  "Repeat buyers are built through reliability, not luck."
];

export default function TipOfTheDay() {
  const [tip, setTip] = useState("");

  useEffect(() => {
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    setTip(randomTip);
  }, []);

  const quickActions = [
    {
      title: "Add Inventory",
      icon: Package,
      link: createPageUrl("AddInventoryItem"),
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      title: "Add Sale",
      icon: Plus,
      link: createPageUrl("AddSale"),
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/20"
    },
    {
      title: "Create Listing",
      icon: Layers,
      link: createPageUrl("Crosslist"),
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
      title: "View Reports",
      icon: BarChart3,
      link: createPageUrl("Reports"),
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-900/20"
    }
  ];

  return (
    <Card className="border-0 shadow-sm bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 h-full flex flex-col">
      <CardContent className="p-6 lg:pb-6 pb-3 flex flex-col h-full">
        {/* Tip of the Day Section */}
        <div className="flex flex-col mb-4">
          <div className="flex items-start gap-4 mb-4">
            <Lightbulb className="w-6 h-6 md:w-8 md:h-8 text-yellow-600 dark:text-yellow-400 mt-1 flex-shrink-0" />
            <p className="font-semibold text-yellow-900 dark:text-yellow-200 md:text-lg">Tip of the Day</p>
          </div>
          <p className="text-sm md:text-base text-yellow-800 dark:text-yellow-300 line-clamp-3">"{tip}"</p>
        </div>

        {/* Quick Actions Section - At the bottom, only on desktop */}
        <div className="hidden lg:block border-t border-yellow-300 dark:border-yellow-700 pt-3 lg:pb-0 pb-0 mt-auto">
          <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-200 mb-2">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.title} to={action.link}>
                  <Button
                    variant="outline"
                    className={`w-full h-auto flex flex-col items-center justify-center gap-1.5 p-2.5 hover:shadow-md transition-all ${action.bgColor} border-2 hover:border-opacity-50 text-xs`}
                  >
                    <Icon className={`w-4 h-4 ${action.color}`} />
                    <span className="font-semibold text-gray-700 dark:text-gray-300 leading-tight">
                      {action.title}
                    </span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}