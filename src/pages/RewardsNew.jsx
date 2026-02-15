import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  ArrowLeft, Gift, Trophy, Star, Award, Flame, Coins, Sparkles, 
  Calendar, TrendingUp, Zap, Clock, CheckCircle, Circle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { toast } from "sonner";
import { getTierInfo, TIER_THRESHOLDS } from "@/config/rewardsRules";

// Reward icon mapping
const rewardIconMap = {
  pulse_mode_7d: Flame,
  sub_credit_5: Gift,
  sub_credit_10: Gift,
};

// Tier colors
const tierColors = {
  bronze: { bg: 'bg-amber-900/20', border: 'border-amber-700', text: 'text-amber-700' },
  silver: { bg: 'bg-slate-300/20', border: 'border-slate-400', text: 'text-slate-400' },
  gold: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-500' },
  platinum: { bg: 'bg-gray-400/20', border: 'border-gray-300', text: 'text-gray-300' },
};

export default function RewardsNew() {
  const [selectedReward, setSelectedReward] = useState(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const queryClient = useQueryClient();

  // Fetch rewards state
  const { data: rewardsState, isLoading: stateLoading } = useQuery({
    queryKey: ["rewardsState"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc('get_rewards_state', {
        p_user_id: user.id
      });

      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
  });

  // Fetch rewards catalog
  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["rewardsCatalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards_catalog")
        .select("*")
        .eq("active", true)
        .order("sort_order");

      if (error) throw error;
      return data;
    },
  });

  // Fetch recent events
  const { data: recentEvents } = useQuery({
    queryKey: ["rewardsEvents"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("rewards_events")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  // Redeem mutation
  const redeemMutation = useMutation({
    mutationFn: async ({ rewardKey }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const idempotencyKey = `redeem:${rewardKey}:${Date.now()}`;

      // Deduct points
      const { data: deductSuccess, error: deductError } = await supabase.rpc('deduct_points', {
        p_user_id: user.id,
        p_points: selectedReward.points_cost,
      });

      if (deductError || !deductSuccess) {
        throw new Error('Insufficient points');
      }

      // Create redemption record
      const { data: redemption, error: redemptionError } = await supabase
        .from('rewards_redemptions')
        .insert({
          user_id: user.id,
          reward_key: rewardKey,
          points_spent: selectedReward.points_cost,
          status: 'fulfilled',
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

      if (redemptionError) throw redemptionError;

      // Create ledger event
      await supabase.from('rewards_events').insert({
        user_id: user.id,
        event_type: 'REDEEM',
        action_key: rewardKey,
        points_delta: -selectedReward.points_cost,
        xp_delta: 0,
        source_type: 'redemption',
        source_id: redemption.id,
        idempotency_key: `event:${idempotencyKey}`,
        meta: { rewardName: selectedReward.name },
      });

      // Activate Pulse Mode if applicable
      if (rewardKey === 'pulse_mode_7d') {
        await supabase.rpc('activate_pulse_mode', {
          p_user_id: user.id,
          p_duration_days: 7,
        });
      }

      return redemption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["rewardsState"]);
      queryClient.invalidateQueries(["rewardsEvents"]);
      toast.success(`${selectedReward.name} redeemed!`);
      setSelectedReward(null);
      setIsRedeeming(false);
    },
    onError: (error) => {
      toast.error(`Redemption failed: ${error.message}`);
      setIsRedeeming(false);
    },
  });

  if (stateLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading rewards...</p>
        </div>
      </div>
    );
  }

  const state = rewardsState || {};
  const tierInfo = getTierInfo(state.xp_total || 0);
  const availableRewards = catalog?.filter(r => state.points_balance >= r.points_cost) || [];
  const lockedRewards = catalog?.filter(r => state.points_balance < r.points_cost) || [];
  const tierColor = tierColors[state.tier || 'bronze'];

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
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Orben Points & Rewards</h1>
              <p className="text-sm text-muted-foreground mt-1">Earn points, unlock tiers, redeem rewards</p>
            </div>
          </div>
        </div>

        {/* Points Summary + Tier + Streak */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Points Balance */}
          <Card className={`border-2 ${tierColor.border} ${tierColor.bg}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className={`w-5 h-5 ${tierColor.text}`} />
                Orben Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground">
                  {(state.points_balance || 0).toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">OP</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {(state.points_earned_lifetime || 0).toLocaleString()} earned all-time
              </p>
            </CardContent>
          </Card>

          {/* Tier */}
          <Card className={`border-2 ${tierColor.border} ${tierColor.bg}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className={`w-5 h-5 ${tierColor.text}`} />
                Tier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className={`${tierColor.bg} ${tierColor.text} border ${tierColor.border} text-sm px-3 py-1`}>
                    {(state.tier || 'bronze').toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {(state.xp_total || 0).toLocaleString()} XP
                  </span>
                </div>
                {tierInfo.next && (
                  <>
                    <Progress value={tierInfo.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {tierInfo.xpNeeded.toLocaleString()} XP to {tierInfo.next.label}
                    </p>
                  </>
                )}
                {!tierInfo.next && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    🎉 Max Tier Reached!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Streak */}
          <Card className="border-2 border-orange-500/30 bg-orange-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-5 h-5 text-orange-500" />
                Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-foreground">
                    {state.active_days_streak || 0}
                  </span>
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">
                    {state.points_multiplier ? `${state.points_multiplier}x` : '1.0x'} multiplier
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pulse Mode Status */}
        {state.pulse_mode_active && (
          <Card className="border-2 border-red-500 bg-gradient-to-r from-red-500/10 to-orange-500/10">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <Flame className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">🔥 Pulse Mode Active</h3>
                    <p className="text-sm text-muted-foreground">
                      Expires {new Date(state.pulse_mode_expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Link to={createPageUrl("Deals")}>
                  <Button variant="outline" size="sm">
                    View Pulse Deals
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs: Catalog | History */}
        <Tabs defaultValue="catalog" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="catalog">Rewards Catalog</TabsTrigger>
            <TabsTrigger value="history">Activity</TabsTrigger>
          </TabsList>

          {/* Catalog Tab */}
          <TabsContent value="catalog" className="space-y-6 mt-6">
            {/* Available Rewards */}
            {availableRewards.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-emerald-500" />
                  Available Rewards
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableRewards.map((reward) => {
                    const IconComponent = rewardIconMap[reward.reward_key] || Gift;
                    return (
                      <Card
                        key={reward.id}
                        className="border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20 hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => setSelectedReward(reward)}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600">
                              <IconComponent className="w-6 h-6 text-white" />
                            </div>
                            <Badge className="bg-emerald-600 text-white">Available</Badge>
                          </div>
                          <h3 className="font-semibold text-foreground mb-2">{reward.name}</h3>
                          <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                            {reward.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground flex items-center gap-1">
                              <Coins className="w-4 h-4" />
                              {reward.points_cost.toLocaleString()}
                            </span>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                              Redeem
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Locked Rewards */}
            {lockedRewards.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                  Locked Rewards
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lockedRewards.map((reward) => {
                    const IconComponent = rewardIconMap[reward.reward_key] || Gift;
                    const pointsNeeded = reward.points_cost - state.points_balance;
                    const progress = Math.min((state.points_balance / reward.points_cost) * 100, 100);
                    return (
                      <Card
                        key={reward.id}
                        className="border border-border/60 bg-muted/20 opacity-75"
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="p-2 rounded-lg bg-muted">
                              <IconComponent className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <Badge variant="secondary">Locked</Badge>
                          </div>
                          <h3 className="font-semibold text-muted-foreground mb-2">{reward.name}</h3>
                          <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                            {reward.description}
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {state.points_balance.toLocaleString()} / {reward.points_cost.toLocaleString()}
                              </span>
                              <span className="text-muted-foreground font-medium">
                                {pointsNeeded.toLocaleString()} more
                              </span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentEvents && recentEvents.length > 0 ? (
                  <div className="space-y-3">
                    {recentEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          {event.event_type === 'EARN' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-orange-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {event.action_key.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(event.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${event.points_delta > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                            {event.points_delta > 0 ? '+' : ''}{event.points_delta} OP
                          </p>
                          <p className="text-xs text-muted-foreground">
                            +{event.xp_delta} XP
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No activity yet. Start earning points!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Redeem Dialog */}
        {selectedReward && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !isRedeeming && setSelectedReward(null)}
          >
            <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>Redeem {selectedReward.name}?</CardTitle>
                <CardDescription>{selectedReward.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cost:</span>
                    <span className="text-lg font-bold">
                      {selectedReward.points_cost.toLocaleString()} OP
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Your Balance:</span>
                    <span className="text-lg font-bold">
                      {state.points_balance.toLocaleString()} OP
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium">After Redemption:</span>
                    <span className="text-lg font-bold text-emerald-600">
                      {(state.points_balance - selectedReward.points_cost).toLocaleString()} OP
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedReward(null)}
                    disabled={isRedeeming}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      setIsRedeeming(true);
                      redeemMutation.mutate({ rewardKey: selectedReward.reward_key });
                    }}
                    disabled={isRedeeming}
                  >
                    {isRedeeming ? 'Redeeming...' : 'Confirm'}
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
