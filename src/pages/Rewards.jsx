import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Gift, Trophy, Star, Award, Package, DollarSign, Truck, ShoppingBag, Zap, Coins, Sparkles, Flame, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import Gamification from "@/components/dashboard/Gamification";
import { getTierInfo, TIER_THRESHOLDS } from "@/config/rewardsRules";
import { toast } from "sonner";

// Reward icon mapping
const rewardIconMap = {
  pulse_mode_7d: Flame,
  sub_credit_5: Gift,
  sub_credit_10: Gift,
};

// Achievement definitions
const achievementDefinitions = [
  {
    id: "first-sale",
    name: "First Sale!",
    description: "Made your first sale",
    icon: Award,
    color: "text-green-500",
    points: 50,
  },
  {
    id: "10-sales",
    name: "10 Sales",
    description: "Reached 10 total sales",
    icon: Star,
    color: "text-blue-500",
    points: 200,
  },
  {
    id: "50-sales",
    name: "50 Sales",
    description: "Reached 50 total sales",
    icon: Star,
    color: "text-indigo-500",
    points: 500,
  },
  {
    id: "100-sales",
    name: "100 Sales",
    description: "Reached 100 total sales",
    icon: Trophy,
    color: "text-amber-500",
    points: 1000,
  },
  {
    id: "1k-profit",
    name: "$1k Profit Club",
    description: "Earned $1,000 in total profit",
    icon: DollarSign,
    color: "text-emerald-500",
    points: 1000,
  },
  {
    id: "10k-profit",
    name: "$10k Profit Club",
    description: "Earned $10,000 in total profit",
    icon: DollarSign,
    color: "text-emerald-600",
    points: 10000,
  },
];

export default function Rewards() {
  const [selectedReward, setSelectedReward] = useState(null);

  // Fetch user stats (simplified - in production would fetch from API)
  const { data: stats } = useQuery({
    queryKey: ["userStats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { totalProfit: 0, totalSales: 0, totalListings: 0 };

      // Fetch sales for profit calculation
      const { data: sales } = await supabase
        .from("sales")
        .select("profit, sale_price, purchase_price")
        .eq("user_id", user.id);

      const totalProfit = sales?.reduce((sum, s) => sum + (s.profit || (s.sale_price - s.purchase_price) || 0), 0) || 0;
      const totalSales = sales?.length || 0;

      // Fetch inventory for listing count
      const { data: inventory } = await supabase
        .from("inventory_items")
        .select("id")
        .eq("user_id", user.id);

      return {
        totalProfit,
        totalSales,
        totalListings: inventory?.length || 0,
        sales: sales || [], // Include sales data for Gamification component
      };
    },
  });

  const points = calculatePoints(stats || {});
  const availableRewards = rewardTiers.filter(r => points >= r.cost);
  const lockedRewards = rewardTiers.filter(r => points < r.cost);

  const earnedAchievements = React.useMemo(() => {
    if (!stats) return [];
    const earned = [];
    if (stats.totalSales >= 1) earned.push(achievementDefinitions[0]);
    if (stats.totalSales >= 10) earned.push(achievementDefinitions[1]);
    if (stats.totalSales >= 50) earned.push(achievementDefinitions[2]);
    if (stats.totalSales >= 100) earned.push(achievementDefinitions[3]);
    if (stats.totalProfit >= 1000) earned.push(achievementDefinitions[4]);
    if (stats.totalProfit >= 10000) earned.push(achievementDefinitions[5]);
    return earned;
  }, [stats]);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Rewards & Points</h1>
              <p className="text-sm text-muted-foreground mt-1">Earn points by listing and selling items</p>
            </div>
          </div>
        </div>

        {/* Your Progress Section */}
        <Gamification
          sales={stats?.sales || []}
          stats={{ 
            totalProfit: stats?.totalProfit || 0, 
            totalSales: stats?.totalSales || 0, 
            avgProfit: stats?.totalSales ? (stats?.totalProfit / stats?.totalSales) : 0,
            profitMargin: 0,
            averageSaleSpeed: 0
          }}
          variant="mosaic"
          progressVariant="gaming"
        />

        {/* Points Summary */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              Your Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{points.toLocaleString()}</span>
              <span className="text-muted-foreground">points</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Earn points by listing items (10 pts each) and making sales (1 pt per $1 profit)
            </p>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {achievementDefinitions.map((ach) => {
                const earned = earnedAchievements.some(e => e.id === ach.id);
                const IconComponent = ach.icon;
                return (
                  <div
                    key={ach.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      earned
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
                        : "bg-muted/40 border-border opacity-50"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <IconComponent className={`w-8 h-8 ${earned ? ach.color : "text-muted-foreground"}`} />
                      <div className="text-center">
                        <p className={`text-xs font-semibold ${earned ? "text-foreground" : "text-muted-foreground"}`}>
                          {ach.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">{ach.description}</p>
                        <Badge variant="secondary" className="mt-2 text-xs">
                          +{ach.points} pts
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Available Rewards */}
        {availableRewards.length > 0 && (
          <Card className="border border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-emerald-500" />
                Available Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableRewards.map((reward) => {
                  const IconComponent = reward.icon;
                  return (
                    <Card
                      key={reward.id}
                      className="border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => setSelectedReward(reward)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${reward.gradient}`}>
                            <IconComponent className="w-6 h-6 text-white" />
                          </div>
                          <Badge className="bg-emerald-600 text-white">Available</Badge>
                        </div>
                        <h3 className="font-semibold text-foreground mb-1">{reward.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3">{reward.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{reward.cost.toLocaleString()} pts</span>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                            Redeem
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Locked Rewards */}
        {lockedRewards.length > 0 && (
          <Card className="border border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-muted-foreground" />
                Locked Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lockedRewards.map((reward) => {
                  const IconComponent = reward.icon;
                  const pointsNeeded = reward.cost - points;
                  const progress = Math.min((points / reward.cost) * 100, 100);
                  return (
                    <Card
                      key={reward.id}
                      className="border border-border/60 bg-muted/20 opacity-75"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <IconComponent className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <Badge variant="secondary">Locked</Badge>
                        </div>
                        <h3 className="font-semibold text-muted-foreground mb-1">{reward.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3">{reward.description}</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{points.toLocaleString()} / {reward.cost.toLocaleString()} pts</span>
                            <span className="text-muted-foreground">{pointsNeeded.toLocaleString()} more needed</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Redeem Dialog */}
        {selectedReward && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedReward(null)}>
            <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>Redeem {selectedReward.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{selectedReward.description}</p>
                <div className="p-4 bg-muted/40 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cost:</span>
                    <span className="text-lg font-bold">{selectedReward.cost.toLocaleString()} points</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-medium">Your Points:</span>
                    <span className="text-lg font-bold">{points.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSelectedReward(null)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                    // TODO: Implement redemption logic
                    alert(`Redeeming ${selectedReward.name} for ${selectedReward.cost} points...`);
                    setSelectedReward(null);
                  }}>
                    Confirm Redeem
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
