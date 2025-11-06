import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Trophy, Star, Box, Wrench, Gem, Crown, TrendingUp } from "lucide-react";

const levels = [
  { name: "Newbie Flipper", minProfit: 0, icon: Box, color: "text-gray-500" },
  { name: "Garage Hustler", minProfit: 100, icon: Wrench, color: "text-orange-500" },
  { name: "Side Hustle Pro", minProfit: 500, icon: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/abe917726_boy.png", color: "text-blue-500" },
  { name: "Marketplace Mogul", minProfit: 2500, icon: Gem, color: "text-purple-500" },
  { name: "Reselling Royalty", minProfit: 10000, icon: Crown, color: "text-amber-500" },
];

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

  return (
    <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-foreground">Your Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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