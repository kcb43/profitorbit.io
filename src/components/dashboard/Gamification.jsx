import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Trophy, Star, Box, Wrench, Gem, Crown, TrendingUp, Medal, Gift, Sparkles, Zap } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export default function Gamification({ sales, stats, variant, progressVariant = "og" }) {
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

  // Render function for achievements and rewards button (shared across variants)
  const renderAchievementsAndRewards = () => (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-muted-foreground">Achievements</div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {achievements.length > 0 ? (
          <TooltipProvider>
            {achievements.map((ach) => (
              <Tooltip key={ach.name}>
                <TooltipTrigger asChild>
                  <button className="p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                    <ach.icon className={`w-5 h-5 ${ach.color}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold">{ach.name}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        ) : (
          <div className="text-xs text-muted-foreground">Your first achievement is just around the corner!</div>
        )}
      </div>
      
      {/* View Rewards Button */}
      <div className="pt-4 border-t border-border/60">
        <p className="text-xs text-muted-foreground mb-3 text-center">
          Earn points, enjoy Rewards
        </p>
        <Link 
          to={createPageUrl("Rewards")} 
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg"
        >
          <Gift className="w-4 h-4" />
          View Rewards
        </Link>
      </div>
    </>
  );

  if (variant === "mosaic") {
    // OG (Original) Variant
    if (progressVariant === "og") {
      return (
        <Card className="border border-gray-200/70 dark:border-gray-800/70 shadow-sm bg-white dark:bg-gray-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">Your Progress</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center justify-center sm:justify-start">
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier</div>
                <div className="mt-1 text-xl font-bold text-foreground leading-tight">{tierInfo.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{points.toLocaleString()} pts</div>
              </div>
            </div>

            <div>
              {renderAchievementsAndRewards()}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Variation 1: Glassmorphism - Modern glass effect with animated gradients
    if (progressVariant === "glass") {
      return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white/80 via-white/60 to-white/40 dark:from-gray-900/80 dark:via-gray-900/60 dark:to-gray-900/40 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent" />
          
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Your Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4 relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tier Badge */}
              <div className={`rounded-2xl bg-gradient-to-br ${tierInfo.color} backdrop-blur-md border ${tierInfo.border} p-4 shadow-xl relative overflow-hidden group`}>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full animate-ping-slow opacity-75" />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <div className="relative z-10">
                  <div className="text-xs text-white/70 uppercase tracking-wider mb-1">Your Tier</div>
                  <div className="text-2xl font-black text-white mb-1">{tierInfo.name}</div>
                  <div className="text-sm text-white/90 font-medium">{points.toLocaleString()} pts</div>
                </div>
                <Medal className="absolute bottom-2 right-2 w-12 h-12 text-white/20" />
              </div>

              {/* Points Card */}
              <div className="rounded-2xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-white/20 dark:border-gray-700/20 p-4 shadow-lg">
                <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Total Points</div>
                <div className="text-2xl font-bold text-foreground">{points.toLocaleString()}</div>
              </div>
            </div>

            <div>
              {renderAchievementsAndRewards()}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Variation 2: Minimalist Badge - Clean, focused design
    if (progressVariant === "minimal") {
      return (
        <Card className="border border-gray-200/50 dark:border-gray-800/50 shadow-sm bg-white dark:bg-gray-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Your Progress</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-5">
            {/* Centered Tier Badge */}
            <div className={`mx-auto max-w-xs rounded-2xl bg-gradient-to-br ${tierInfo.color} border-2 ${tierInfo.border} p-6 text-center shadow-lg relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
              <div className="relative z-10">
                <Medal className="w-8 h-8 mx-auto mb-2 text-white/90" />
                <div className="text-xs text-white/70 uppercase tracking-wider mb-1">Tier</div>
                <div className="text-3xl font-black text-white mb-2">{tierInfo.name}</div>
                <div className="text-sm text-white/90">{points.toLocaleString()} points</div>
              </div>
            </div>

            <div>
              {renderAchievementsAndRewards()}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Variation 3: Gaming Style - Bold, colorful with animated elements
    if (progressVariant === "gaming") {
      const [selectedAchievement, setSelectedAchievement] = useState(null);

      return (
        <Card className="border-0 shadow-xl bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 [data-theme='money-green-dark']:bg-gradient-to-br [data-theme='money-green-dark']:from-gray-900 [data-theme='money-green-dark']:via-gray-800 [data-theme='money-green-dark']:to-gray-900 [data-theme='money-green-light']:bg-white relative overflow-hidden">
          {/* Top gradient bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-purple-500 to-blue-500" />
          
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="text-base font-bold text-gray-900 dark:text-white [data-theme='money-green-dark']:text-white [data-theme='money-green-light']:text-gray-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400 dark:text-emerald-400" />
              Your Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4 relative z-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tier - styled like glass variant with blue colors */}
              <div className="relative rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 dark:from-blue-500/20 dark:to-indigo-500/20 backdrop-blur-md border border-blue-500/30 dark:border-blue-500/30 p-4 shadow-xl overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 rounded-2xl" />
                <div className="relative z-10">
                  <div className="text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1">Your Tier</div>
                  <div className="text-2xl font-black text-blue-900 dark:text-white">{tierInfo.name}</div>
                </div>
                <Medal className="absolute bottom-2 right-2 w-12 h-12 text-blue-400/30 dark:text-white/20" />
              </div>

              {/* Points */}
              <div className="rounded-xl bg-blue-50/80 dark:bg-gray-900/90 [data-theme='money-green-dark']:bg-gray-900/90 [data-theme='money-green-light']:bg-blue-50/80 backdrop-blur-sm border border-blue-500/30 dark:border-blue-500/30 [data-theme='money-green-dark']:border-blue-500/30 [data-theme='money-green-light']:border-blue-500/30 p-4 shadow-lg">
                <div className="text-xs text-blue-600 dark:text-blue-400 [data-theme='money-green-dark']:text-blue-400 [data-theme='money-green-light']:text-blue-600 mb-1 uppercase tracking-wide font-semibold">Points</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-white [data-theme='money-green-dark']:text-white [data-theme='money-green-light']:text-blue-900">{points.toLocaleString()}</div>
              </div>
            </div>

            {/* Achievements Section - Custom for Gaming */}
            <div className="bg-gray-100/60 dark:bg-gray-900/90 [data-theme='money-green-dark']:bg-gray-900/90 [data-theme='money-green-light']:bg-gray-100/60 rounded-xl p-4 border border-gray-300/50 dark:border-gray-800/50 [data-theme='money-green-dark']:border-gray-800/50 [data-theme='money-green-light']:border-gray-300/50">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-900 dark:text-white [data-theme='money-green-dark']:text-white [data-theme='money-green-light']:text-gray-900">Achievements</div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {achievements.length > 0 ? (
                  achievements.map((ach) => (
                    <div key={ach.name} className="relative flex-shrink-0">
                      <button
                        onClick={() => setSelectedAchievement(selectedAchievement === ach.name ? null : ach.name)}
                        className="relative p-3 sm:p-4 rounded-xl bg-white/80 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-700/70 border border-gray-300/50 dark:border-gray-600/50 hover:border-gray-400 dark:hover:border-gray-500/70 transition-all group"
                      >
                        <ach.icon className={`w-6 h-6 sm:w-8 sm:h-8 ${ach.color}`} />
                        {/* Smooth label on click */}
                        {selectedAchievement === ach.name && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 dark:bg-gray-800 text-white dark:text-gray-100 text-xs font-semibold rounded-lg whitespace-nowrap shadow-lg border border-gray-700 dark:border-gray-600 animate-in fade-in slide-in-from-bottom-2 z-30">
                            {ach.name}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 dark:bg-gray-800 border-r border-b border-gray-700 dark:border-gray-600 rotate-45"></div>
                          </div>
                        )}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-600 dark:text-gray-400">Your first achievement is just around the corner!</div>
                )}
              </div>
              
              {/* View Rewards Button */}
              <div className="pt-4 mt-4 border-t border-gray-300/50 dark:border-gray-800/50 [data-theme='money-green-dark']:border-gray-800/50 [data-theme='money-green-light']:border-gray-300/50 relative">
                <Link 
                  to={createPageUrl("Rewards")} 
                  className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-white dark:bg-gray-900 [data-theme='money-green-dark']:bg-gray-900 [data-theme='money-green-light']:bg-white hover:bg-gray-50 dark:hover:bg-gray-800 [data-theme='money-green-dark']:hover:bg-gray-800 [data-theme='money-green-light']:hover:bg-gray-50 text-gray-900 dark:text-white [data-theme='money-green-dark']:text-white [data-theme='money-green-light']:text-gray-900 font-semibold text-sm transition-all shadow-md hover:shadow-lg relative border border-gray-300 dark:border-gray-700 [data-theme='money-green-dark']:border-gray-700 [data-theme='money-green-light']:border-gray-300"
                >
                  {/* Green dot positioned on top right of button */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full animate-ping-slow opacity-75 z-30" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full z-30" />
                  View Rewards
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Variation 4: Card Stack - Layered card design with depth
    if (progressVariant === "stack") {
      return (
        <div className="relative">
          {/* Background card layer */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-950/30 dark:to-green-950/30 rounded-2xl transform translate-y-1 translate-x-1 opacity-50" />
          
          {/* Main card */}
          <Card className="border border-gray-200/70 dark:border-gray-800/70 shadow-lg bg-white dark:bg-gray-950 relative z-10">
            <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50/50 to-green-50/50 dark:from-emerald-950/20 dark:to-green-950/20 rounded-t-lg">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Your Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Tier Badge - Elevated */}
              <div className={`relative rounded-xl bg-gradient-to-br ${tierInfo.color} border-2 ${tierInfo.border} p-4 shadow-xl transform hover:scale-105 transition-transform`}>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full animate-ping-slow opacity-75" />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full" />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/70 uppercase tracking-wide mb-1">Your Tier</div>
                    <div className="text-2xl font-black text-white">{tierInfo.name}</div>
                    <div className="text-sm text-white/90 mt-1">{points.toLocaleString()} pts</div>
                  </div>
                  <Medal className="w-12 h-12 text-white/30" />
                </div>
              </div>

              <div>
                {renderAchievementsAndRewards()}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Fallback to OG if invalid variant
    return null;
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Achievements</p>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {achievements.length > 0 ? (
              <TooltipProvider>
                {achievements.map(ach => (
                  <Tooltip key={ach.name}>
                    <TooltipTrigger asChild>
                      <button className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <ach.icon className={`w-5 h-5 ${ach.color}`} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">{ach.name}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            ) : (
              <p className="text-xs text-gray-500">Your first achievement is just around the corner!</p>
            )}
          </div>
          
          {/* View Rewards Button */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 text-center">
              Earn points, enjoy Rewards
            </p>
            <Link 
              to={createPageUrl("Rewards")} 
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg"
            >
              <Gift className="w-4 h-4" />
              View Rewards
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}