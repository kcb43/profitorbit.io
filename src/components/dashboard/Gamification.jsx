import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Trophy, Star, Box, Wrench, Gem, Crown, TrendingUp, Medal } from "lucide-react";

const levels = [
  { name: "Newbie Flipper", minProfit: 0, icon: Box, color: "text-gray-500" },
  { name: "Garage Hustler", minProfit: 100, icon: Wrench, color: "text-orange-500" },
  { name: "Side Hustle Pro", minProfit: 500, icon: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/abe917726_boy.png", color: "text-blue-500" },
  { name: "Marketplace Mogul", minProfit: 2500, icon: Gem, color: "text-purple-500" },
  { name: "Reselling Royalty", minProfit: 10000, icon: Crown, color: "text-amber-500" },
];

// Tier mapping based on profit levels
const getTierInfo = (totalProfit) => {
  if (totalProfit >= 10000) {
    return { name: "Diamond", color: "from-cyan-500/20 to-blue-500/20", shadow: "shadow-cyan-500/30", hoverShadow: "hover:shadow-cyan-500/50", border: "border-cyan-500/30" };
  } else if (totalProfit >= 2500) {
    return { name: "Platinum", color: "from-purple-500/20 to-indigo-500/20", shadow: "shadow-purple-500/30", hoverShadow: "hover:shadow-purple-500/50", border: "border-purple-500/30" };
  } else if (totalProfit >= 1000) {
    return { name: "Gold", color: "from-amber-500/20 to-yellow-500/20", shadow: "shadow-amber-500/30", hoverShadow: "hover:shadow-amber-500/50", border: "border-amber-500/30" };
  } else if (totalProfit >= 500) {
    return { name: "Silver", color: "from-gray-400/20 to-slate-500/20", shadow: "shadow-gray-400/30", hoverShadow: "hover:shadow-gray-400/50", border: "border-gray-400/30" };
  } else {
    return { name: "Bronze", color: "from-orange-500/20 to-amber-500/20", shadow: "shadow-orange-500/30", hoverShadow: "hover:shadow-orange-500/50", border: "border-orange-500/30" };
  }
};

export default function Gamification({ sales, stats }) {
  const achievements = React.useMemo(() => {
    const earned = [];
    if (stats.totalProfit >= 1000) {
      earned.push({ name: "$1k Profit Club", icon: Trophy, color: "text-amber-500" });
    }
    if (stats.totalSales >= 100) {
      earned.push({ name: "100 Sales", icon: Star, color: "text-blue-500" });
    }
    if (stats.totalSales >= 1) {
      earned.push({ name: "First Sale!", icon: Award, color: "text-green-500" });
    }
    return earned;
  }, [stats]);

  const currentLevel = React.useMemo(() => {
    return [...levels].reverse().find(level => stats.totalProfit >= level.minProfit) || levels[0];
  }, [stats.totalProfit]);

  const nextLevel = React.useMemo(() => {
    return levels.find(level => stats.totalProfit < level.minProfit);
  }, [stats.totalProfit]);

  const progressToNextLevel = React.useMemo(() => {
    if (!nextLevel) return 100;
    const levelStartProfit = currentLevel.minProfit;
    const levelEndProfit = nextLevel.minProfit;
    const profitInRange = stats.totalProfit - levelStartProfit;
    const range = levelEndProfit - levelStartProfit;
    return Math.min((profitInRange / range) * 100, 100);
  }, [stats.totalProfit, currentLevel, nextLevel]);

  const renderIcon = (iconOrUrl, className) => {
    if (typeof iconOrUrl === 'string') {
      return <img src={iconOrUrl} alt="Level icon" className={`w-8 h-8 object-contain ${className}`} />;
    }
    const IconComponent = iconOrUrl;
    return <IconComponent className={`w-8 h-8 ${className}`} />;
  };

  const tierInfo = React.useMemo(() => getTierInfo(stats.totalProfit), [stats.totalProfit]);
  
  // Calculate points (using total profit as points for now, can be adjusted)
  const points = Math.floor(stats.totalProfit);

  return (
    <Card className="border-0 shadow-sm bg-white dark:bg-gray-900 relative overflow-hidden">
      {/* Gradient blur effect - positioned like the example */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-full blur-[64px] pointer-events-none" style={{ bottom: '-108px' }} />
      
      <CardHeader className="relative z-10">
        <CardTitle className="text-xl font-bold text-foreground">Your Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 relative z-10">
        {/* Tier Badge */}
        <div className={`relative rounded-2xl p-6 shadow-lg ${tierInfo.shadow} ${tierInfo.hoverShadow} transition-shadow duration-300 overflow-hidden group bg-gradient-to-br ${tierInfo.color} border ${tierInfo.border}`}>
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
          
          <div className="relative flex items-center gap-5">
            {/* Icon with hexagonal backdrop */}
            <div className="relative flex-shrink-0">
              {/* Rotating ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/30 to-transparent animate-spin-slow pointer-events-none" />
              
              {/* Icon container */}
              <div className="relative w-20 h-20 rounded-full bg-white/20 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 group-hover:scale-110 transition-transform duration-300">
                <Medal className="w-10 h-10 text-white drop-shadow-lg" />
              </div>
            </div>
            
            {/* Tier info */}
            <div className="flex-1 min-w-0">
              <div className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Your Tier</div>
              <h3 className="text-white text-3xl font-black tracking-tight mb-1 drop-shadow-lg">{tierInfo.name}</h3>
              <div className="flex items-center gap-2">
                <div className="h-1 w-12 bg-gradient-to-r from-white/50 to-transparent rounded-full" />
                <span className="text-white/80 text-sm font-medium">{points.toLocaleString()} points</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Current Level</p>
          <div className="flex items-center gap-3 mb-3">
             {renderIcon(currentLevel.icon, currentLevel.color)}
             <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-gray-200">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  {currentLevel.name}
                </h3>
                {nextLevel ? (
                    <p className="text-xs text-gray-500">Next: {nextLevel.name}</p>
                ) : (
                    <p className="text-xs text-green-500 font-semibold">Max Level Reached!</p>
                )}
             </div>
          </div>
          {nextLevel && (
            <div>
              <div className="flex justify-between items-center mb-1 text-xs">
                <span className="text-gray-500">${stats.totalProfit.toFixed(0)}</span>
                <span className="text-gray-500">${nextLevel.minProfit}</span>
              </div>
              <Progress value={progressToNextLevel} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-green-400 [&>div]:to-blue-500" />
            </div>
          )}
        </div>
        
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Achievements</p>
          <div className="flex flex-wrap gap-2">
            {achievements.length > 0 ? achievements.map(ach => (
              <Badge key={ach.name} variant="secondary" className="px-3 py-1.5 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <ach.icon className={`w-4 h-4 mr-2 ${ach.color}`} />
                <span className="font-semibold text-gray-700 dark:text-gray-300">{ach.name}</span>
              </Badge>
            )) : (
              <p className="text-xs text-gray-500">Your first achievement is just around the corner!</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}