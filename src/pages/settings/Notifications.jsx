import React from 'react';
import NotificationRewardsSettings from '@/components/NotificationRewardsSettings';
import { getSectionById } from '@/modules/settingsRegistry';
import SettingsSectionLayout from '@/components/settings/SettingsSectionLayout';

const section = getSectionById('notifications');

export default function NotificationsSettings() {
  return (
    <SettingsSectionLayout section={section}>
      <NotificationRewardsSettings />
    </SettingsSectionLayout>
  );
}
