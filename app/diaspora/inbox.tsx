import React from 'react';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import InboxScreenLayout from '@/components/InboxScreenLayout';
import { clientMenuItems } from '@/constants/premiumMenus';

export default function InboxScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <InboxScreenLayout
      role="client"
      menuItems={clientMenuItems(router, t)}
      heroLabel={t('messagesSubtitleClient') || 'Client Messages'}
      subtitleFallback={t('conversationsTitle')}
    />
  );
}
