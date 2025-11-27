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
    return { name: "Diamond", nextTier: null, color: "from-cyan-500/20 to-blue-500/20", shadow: "shadow-cyan-500/30", hoverShadow: "hover:shadow-cyan-500/50", border: "border-cyan-500/30", nextTierMin: null };
  } else if (totalProfit >= 2500) {
    return { name: "Platinum", nextTier: "Diamond", color: "from-purple-500/20 to-indigo-500/20", shadow: "shadow-purple-500/30", hoverShadow: "hover:shadow-purple-500/50", border: "border-purple-500/30", nextTierMin: 10000 };
  } else if (totalProfit >= 1000) {
    return { name: "Gold", nextTier: "Platinum", color: "from-amber-500/20 to-yellow-500/20", shadow: "shadow-amber-500/30", hoverShadow: "hover:shadow-amber-500/50", border: "border-amber-500/30", nextTierMin: 2500 };
  } else if (totalProfit >= 500) {
    return { name: "Silver", nextTier: "Gold", color: "from-gray-400/20 to-slate-500/20", shadow: "shadow-gray-400/30", hoverShadow: "hover:shadow-gray-400/50", border: "border-gray-400/30", nextTierMin: 1000 };
  } else {
    return { name: "Bronze", nextTier: "Silver", color: "from-orange-500/20 to-amber-500/20", shadow: "shadow-orange-500/30", hoverShadow: "hover:shadow-orange-500/50", border: "border-orange-500/30", nextTierMin: 500 };
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

  // Calculate tier progress
  const tierProgress = React.useMemo(() => {
    if (!tierInfo.nextTier || !tierInfo.nextTierMin) return { percentage: 100, pointsNeeded: 0 };
    
    const currentTierMin = tierInfo.name === "Bronze" ? 0 : 
                           tierInfo.name === "Silver" ? 500 :
                           tierInfo.name === "Gold" ? 1000 :
                           tierInfo.name === "Platinum" ? 2500 : 0;
    
    const profitInRange = stats.totalProfit - currentTierMin;
    const range = tierInfo.nextTierMin - currentTierMin;
    const percentage = Math.min((profitInRange / range) * 100, 100);
    const pointsNeeded = Math.max(0, tierInfo.nextTierMin - stats.totalProfit);
    
    return { percentage, pointsNeeded };
  }, [stats.totalProfit, tierInfo]);

  return (
    <Card className="border-0 shadow-sm bg-white dark:bg-gray-900 relative overflow-hidden">
      
      <CardHeader className="relative z-10">
        <CardTitle className="text-xl font-bold text-foreground">Your Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 relative z-10 bg-gray-50/50 dark:bg-gray-800/30 [data-theme='money-green-dark']:bg-gray-800/30 rounded-lg">
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Current Level */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {renderIcon(currentLevel.icon, currentLevel.color)}
              <div>
                <h3 className="flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-gray-200">
                  <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                  {currentLevel.name}
                </h3>
                {nextLevel ? (
                  <p className="text-base text-gray-600 dark:text-gray-400 mt-1">Next: {nextLevel.name}</p>
                ) : (
                  <p className="text-base text-green-500 font-semibold mt-1">Max Level Reached!</p>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Tier Badge (bigger) */}
          <div className={`relative rounded-xl p-5 shadow-lg ${tierInfo.shadow} ${tierInfo.hoverShadow} transition-shadow duration-300 overflow-hidden group bg-gradient-to-br ${tierInfo.color} border ${tierInfo.border} flex-shrink-0`}>
            {/* Shine effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
            
            <div className="relative flex items-center gap-3">
              {/* Icon with rotating ring */}
              <div className="relative flex-shrink-0">
                {/* Rotating ring */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/30 to-transparent animate-spin-slow pointer-events-none" />
                
                {/* Icon container */}
                <div className="relative w-16 h-16 rounded-full bg-white/20 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 group-hover:scale-110 transition-transform duration-300">
                  <Medal className="w-8 h-8 text-white drop-shadow-lg" />
                </div>
              </div>
              
              {/* Tier info - bigger */}
              <div className="min-w-0">
                <div className="text-white/70 text-xs font-semibold uppercase tracking-wider leading-tight mb-0.5">Your Tier</div>
                <h4 className="text-white text-xl font-black tracking-tight drop-shadow-lg leading-tight">{tierInfo.name}</h4>
                <div className="text-white/80 text-sm font-medium leading-tight">{points.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div>

          {/* Custom Progress Bar */}
          {nextLevel && tierInfo.nextTier && (
            <div className="relative z-10 mt-6 max-w-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700 dark:text-slate-300 text-sm font-medium">Progress to {tierInfo.nextTier}</span>
                <span className="text-green-600 dark:text-green-400 text-sm font-bold">{Math.round(tierProgress.percentage)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-white/10 border border-gray-300 dark:border-transparent overflow-hidden">
                <div 
                  className="h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 transition-[width] duration-1000 ease-out"
                  style={{ width: `${tierProgress.percentage}%` }}
                />
              </div>
              {tierProgress.pointsNeeded > 0 && (
                <div className="text-gray-600 dark:text-slate-400 text-xs mt-2">
                  ${tierProgress.pointsNeeded.toFixed(0)} more needed
                </div>
              )}
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