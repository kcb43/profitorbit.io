import React, { useState } from "react";
import { Bell, X, CheckCircle, Flame, Gift, Trophy, TrendingUp, Package, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/supabaseClient";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const notificationIcons = {
  points_earned: TrendingUp,
  pulse_mode: Flame,
  tier_up: Trophy,
  credit_applied: Gift,
  deal_alert: Package,
  return_reminder: Package,
  listing_nudge: Package,
  news: Bell,
};

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get unread count
      const { data: unreadCount } = await supabase.rpc('get_unread_count', {
        p_user_id: user.id
      });

      return {
        notifications: data,
        unreadCount: unreadCount || 0,
      };
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notificationIds) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc('mark_notifications_read', {
        p_user_id: user.id,
        p_notification_ids: notificationIds,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
    },
  });

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.read_at) {
      markReadMutation.mutate([notification.id]);
    }

    // Handle deep link
    if (notification.deep_link) {
      const link = notification.deep_link.replace('orben://', '/');
      window.location.href = link;
    }

    setIsOpen(false);
  };

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unreadCount || 0;
  const unreadNotifications = notifications.filter(n => !n.read_at);
  const readNotifications = notifications.filter(n => n.read_at);

  return (
    <>
      {/* Bell Icon with Badge */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-16 w-full max-w-md h-[calc(100vh-4rem)] bg-background border-l border-border shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
                <p className="text-xs text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllReadMutation.mutate()}
                  >
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                <Tabs defaultValue="unread" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 m-2">
                    <TabsTrigger value="unread">
                      Unread {unreadCount > 0 && `(${unreadCount})`}
                    </TabsTrigger>
                    <TabsTrigger value="all">All</TabsTrigger>
                  </TabsList>

                  <TabsContent value="unread" className="m-0 p-2 space-y-2">
                    {unreadNotifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">All caught up!</p>
                      </div>
                    ) : (
                      unreadNotifications.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onClick={() => handleNotificationClick(notification)}
                        />
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="all" className="m-0 p-2 space-y-2">
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                      />
                    ))}
                  </TabsContent>
                </Tabs>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="p-3 border-t border-border">
              <Link to={createPageUrl("Settings")} onClick={() => setIsOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Notification Settings
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Notification Item Component
function NotificationItem({ notification, onClick }) {
  const IconComponent = notificationIcons[notification.type] || Bell;
  const isUnread = !notification.read_at;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isUnread ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${getIconBg(notification.type)}`}>
            <IconComponent className={`w-5 h-5 ${getIconColor(notification.type)}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                {notification.title}
              </h4>
              {isUnread && (
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {notification.body}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTimestamp(notification.created_at)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
function getIconBg(type) {
  const colors = {
    points_earned: 'bg-emerald-100 dark:bg-emerald-900/30',
    pulse_mode: 'bg-red-100 dark:bg-red-900/30',
    tier_up: 'bg-yellow-100 dark:bg-yellow-900/30',
    credit_applied: 'bg-purple-100 dark:bg-purple-900/30',
    deal_alert: 'bg-blue-100 dark:bg-blue-900/30',
    return_reminder: 'bg-orange-100 dark:bg-orange-900/30',
    listing_nudge: 'bg-cyan-100 dark:bg-cyan-900/30',
    news: 'bg-slate-100 dark:bg-slate-900/30',
  };
  return colors[type] || 'bg-muted';
}

function getIconColor(type) {
  const colors = {
    points_earned: 'text-emerald-600 dark:text-emerald-400',
    pulse_mode: 'text-red-600 dark:text-red-400',
    tier_up: 'text-yellow-600 dark:text-yellow-400',
    credit_applied: 'text-purple-600 dark:text-purple-400',
    deal_alert: 'text-blue-600 dark:text-blue-400',
    return_reminder: 'text-orange-600 dark:text-orange-400',
    listing_nudge: 'text-cyan-600 dark:text-cyan-400',
    news: 'text-slate-600 dark:text-slate-400',
  };
  return colors[type] || 'text-muted-foreground';
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
