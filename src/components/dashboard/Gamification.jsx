import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Trophy, Star, Box, Wrench, Gem, Crown, TrendingUp, Medal } from "lucide-react";
import narutoIcon from "@/assets/naruto-icon.svg?url";
import sakuraIcon from "@/assets/sakura-icon.svg?url";
import kakashiIcon from "@/assets/kakashi-icon.svg?url";
import wizardIcon from "@/assets/wizard-icon.png?url";

// Character icon mapping
const characterIcons = {
  naruto: narutoIcon,
  sakura: sakuraIcon,
  kakashi: kakashiIcon,
};

// Get the selected character icon from localStorage
// Returns null if no anime character is selected (default theme)
const getSelectedCharacterIcon = () => {
  const selectedCharacter = localStorage.getItem('selectedCharacter');
  // If no character selected or it's an invalid one, return null to use default wizard icon
  if (!selectedCharacter || !characterIcons[selectedCharacter]) {
    return null;
  }
  return characterIcons[selectedCharacter];
};

const baseLevels = [
  { name: "Newbie", minProfit: 0, icon: Box, color: "text-gray-500" },
  { name: "Weekend Warrior", minProfit: 100, icon: Wrench, color: "text-orange-500" },
  { name: "Hustler", minProfit: 250, icon: sakuraIcon, color: "text-pink-500" },
  { name: "Side Hustle Pro", minProfit: 500, icon: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/abe917726_boy.png", color: "text-blue-500" },
  { name: "Flipping Pro", minProfit: 1000, icon: kakashiIcon, color: "text-indigo-500" },
  { name: "Marketplace Mogul", minProfit: 2500, icon: null, color: "text-purple-500" }, // Will be set dynamically
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

export default function Gamification({ sales, stats, variant }) {
  const [selectedCharacterIcon, setSelectedCharacterIcon] = useState(() => getSelectedCharacterIcon());

  // Listen for character changes
  useEffect(() => {
    const handleCharacterChange = () => {
      setSelectedCharacterIcon(getSelectedCharacterIcon());
    };

    window.addEventListener('characterChanged', handleCharacterChange);
    
    // Also check localStorage periodically in case it was changed in another tab
    const interval = setInterval(() => {
      const newIcon = getSelectedCharacterIcon();
      if (newIcon !== selectedCharacterIcon) {
        setSelectedCharacterIcon(newIcon);
      }
    }, 1000);

    return () => {
      window.removeEventListener('characterChanged', handleCharacterChange);
      clearInterval(interval);
    };
  }, [selectedCharacterIcon]);

  // Create levels array with dynamic icon for Marketplace Mogul
  const levels = React.useMemo(() => {
    return baseLevels.map(level => {
      if (level.name === "Marketplace Mogul") {
        // Use anime character icon if selected, otherwise use default wizard icon
        return { ...level, icon: selectedCharacterIcon || wizardIcon };
      }
      return level;
    });
  }, [selectedCharacterIcon]);

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
      return <img src={iconOrUrl} alt="Level icon" className={`w-14 h-14 object-contain ${className}`} />;
    }
    const IconComponent = iconOrUrl;
    return <IconComponent className={`w-14 h-14 ${className}`} />;
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

  if (variant === "mosaic") {
    return (
      <Card className="border border-gray-200/70 dark:border-gray-800/70 shadow-sm bg-white dark:bg-gray-950">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">Your Progress</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-sm text-muted-foreground">Current level</div>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted/40 flex items-center justify-center overflow-hidden">
                  {typeof currentLevel.icon === "string" ? (
                    <img src={currentLevel.icon} alt="Level" className="h-8 w-8 object-contain" />
                  ) : (
                    renderIcon(currentLevel.icon, "text-gray-700 dark:text-gray-200 w-8 h-8")
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-foreground">{currentLevel.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {nextLevel ? `Next: ${nextLevel.name}` : "Max level reached"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier</div>
              <div className="mt-1 text-xl font-bold text-foreground">{tierInfo.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{points.toLocaleString()} pts</div>
            </div>
          </div>

          {tierInfo.nextTier && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progress to {tierInfo.nextTier}</span>
                <span className="font-semibold text-foreground">{Math.round(tierProgress.percentage)}%</span>
              </div>
              <Progress value={tierProgress.percentage} className="h-2" />
              {tierProgress.pointsNeeded > 0 ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  ${tierProgress.pointsNeeded.toFixed(0)} more needed
                </div>
              ) : null}
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Achievements</div>
            <div className="flex flex-wrap gap-2">
              {achievements.length > 0 ? achievements.map((ach) => (
                <Badge key={ach.name} variant="secondary" className="px-3 py-1.5">
                  <ach.icon className={`w-4 h-4 mr-2 ${ach.color}`} />
                  <span className="font-semibold">{ach.name}</span>
                </Badge>
              )) : (
                <div className="text-xs text-muted-foreground">Your first achievement is just around the corner!</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm bg-white dark:bg-gray-900 relative overflow-hidden">
      
      <CardHeader className="relative z-10 bg-gray-50/50 dark:bg-gray-800/30 [data-theme='money-green-dark']:bg-gray-800/30 [data-theme='money-green-light']:bg-gray-50/50 rounded-t-lg">
        <CardTitle className="text-xl font-bold text-foreground">Your Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 relative z-10 bg-gray-50/50 dark:bg-gray-800/30 [data-theme='money-green-dark']:bg-gray-800/30 [data-theme='money-green-light']:bg-gray-50/50 rounded-b-lg min-w-0">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 min-w-0">
          {/* Left side - Current Level */}
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0">{renderIcon(currentLevel.icon, currentLevel.color)}</div>
              <div className="min-w-0 flex-1">
                <h3 className="flex flex-wrap items-center gap-2 text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-200 break-words">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span className="break-words">{currentLevel.name}</span>
                </h3>
                {nextLevel ? (
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 break-words">Next: {nextLevel.name}</p>
                ) : (
                  <p className="text-sm sm:text-base text-green-500 font-semibold mt-1">Max Level Reached!</p>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Tier Badge (bigger) */}
          <div className={`relative rounded-xl p-3 sm:p-5 shadow-lg ${tierInfo.shadow} ${tierInfo.hoverShadow} transition-shadow duration-300 overflow-hidden group bg-gradient-to-br ${tierInfo.color} border ${tierInfo.border} flex-shrink-0 w-full sm:w-auto`}>
            {/* Shine effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />
            
              <div className="relative flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Icon with rotating ring */}
                <div className="relative flex-shrink-0">
                  {/* Rotating ring */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/30 to-transparent animate-spin-slow pointer-events-none" />
                  
                  {/* Icon container */}
                  <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/20 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 group-hover:scale-110 transition-transform duration-300">
                    <Medal className="w-6 h-6 sm:w-8 sm:h-8 text-white drop-shadow-lg" />
                  </div>
                </div>
                
                {/* Tier info - bigger */}
                <div className="min-w-0 flex-1">
                  <div className="text-white/70 text-[10px] sm:text-xs font-semibold uppercase tracking-wider leading-tight mb-0.5 break-words">Your Tier</div>
                  <h4 className="!text-white text-lg sm:text-xl font-black tracking-tight drop-shadow-lg leading-tight break-words" style={{ color: 'white' }}>{tierInfo.name}</h4>
                  <div className="text-white/80 text-xs sm:text-sm font-medium leading-tight">{points.toLocaleString()}</div>
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