import React, { useState, useEffect } from 'react';
import { X, Flame, Gift, TrendingUp, Package, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

/**
 * Banner Notifications
 * 
 * Shows important notifications at the top of the page (above nav).
 * Different from NotificationCenter (bell icon) - these are prominent banners.
 * 
 * User can dismiss them, and they respect notification preferences.
 */

const notificationStyles = {
  deal_alert: {
    bg: 'bg-gradient-to-r from-blue-500 to-blue-600',
    icon: Package,
    iconBg: 'bg-blue-400',
  },
  pulse_mode: {
    bg: 'bg-gradient-to-r from-red-500 to-orange-600',
    icon: Flame,
    iconBg: 'bg-red-400',
  },
  tier_up: {
    bg: 'bg-gradient-to-r from-purple-500 to-pink-600',
    icon: TrendingUp,
    iconBg: 'bg-purple-400',
  },
  credit_applied: {
    bg: 'bg-gradient-to-r from-emerald-500 to-green-600',
    icon: Gift,
    iconBg: 'bg-emerald-400',
  },
  return_reminder: {
    bg: 'bg-gradient-to-r from-orange-500 to-amber-600',
    icon: AlertCircle,
    iconBg: 'bg-orange-400',
  },
};

export default function BannerNotifications() {
  const [dismissed, setDismissed] = useState(() => {
    // Load dismissed notifications from localStorage
    const stored = localStorage.getItem('dismissed_banner_notifications');
    return stored ? JSON.parse(stored) : [];
  });

  const queryClient = useQueryClient();

  // Fetch notifications that should be shown as banners
  const { data: notifications } = useQuery({
    queryKey: ['bannerNotifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get recent unread notifications (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .is('read_at', null)
        .gte('created_at', yesterday)
        // Excluding rewards-related types (benched): 'pulse_mode', 'tier_up', 'credit_applied'
        .in('type', ['deal_alert', 'return_reminder'])
        .order('created_at', { ascending: false })
        .limit(3); // Only show top 3 as banners

      if (error) throw error;
      
      // Filter out dismissed ones
      return (data || []).filter(n => !dismissed.includes(n.id));
    },
    refetchInterval: 60000, // Check every minute
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          notificationIds: [notificationId],
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bannerNotifications']);
      queryClient.invalidateQueries(['notifications']);
    },
  });

  const handleDismiss = (notificationId) => {
    // Add to dismissed list
    const newDismissed = [...dismissed, notificationId];
    setDismissed(newDismissed);
    localStorage.setItem('dismissed_banner_notifications', JSON.stringify(newDismissed));
    
    // Mark as read
    markReadMutation.mutate(notificationId);
  };

  const handleClick = (notification) => {
    // Mark as read when clicked
    markReadMutation.mutate(notification.id);
    
    // Navigate if deep link exists (handled by Link component)
  };

  // Clean up old dismissed IDs (older than 7 days)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const stored = localStorage.getItem('dismissed_banner_notifications');
      if (stored) {
        try {
          const dismissedList = JSON.parse(stored);
          // In a real implementation, you'd check timestamps
          // For now, just keep the list from growing unbounded
          if (dismissedList.length > 50) {
            localStorage.setItem('dismissed_banner_notifications', JSON.stringify(dismissedList.slice(-25)));
            setDismissed(dismissedList.slice(-25));
          }
        } catch (e) {
          console.error('Error cleaning up dismissed notifications:', e);
        }
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(cleanupInterval);
  }, []);

  if (!notifications || notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="pointer-events-auto">
        {notifications.map((notification, index) => {
          const style = notificationStyles[notification.type] || notificationStyles.deal_alert;
          const IconComponent = style.icon;
          
          const content = (
            <div
              key={notification.id}
              className={`${style.bg} text-white shadow-lg animate-slide-down`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`${style.iconBg} rounded-full p-2 flex-shrink-0`}>
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {notification.title}
                      </p>
                      <p className="text-xs text-white/90 truncate">
                        {notification.body}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-white hover:bg-white/20 h-8 w-8"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDismiss(notification.id);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );

          // Wrap in Link if deep link exists
          if (notification.deep_link) {
            const link = notification.deep_link.replace('orben://', '/');
            return (
              <Link
                key={notification.id}
                to={link}
                className="block hover:opacity-95 transition-opacity"
                onClick={() => handleClick(notification)}
              >
                {content}
              </Link>
            );
          }

          return content;
        })}
      </div>
    </div>
  );
}

// Add this to your global CSS or tailwind.config.js
const styles = `
@keyframes slide-down {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-down {
  animation: slide-down 0.3s ease-out forwards;
}
`;
