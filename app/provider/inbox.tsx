import React from 'react';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import InboxScreenLayout from '@/components/InboxScreenLayout';
import { providerMenuItems } from '@/constants/premiumMenus';

export default function ProviderInboxScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <InboxScreenLayout
      role="provider"
      menuItems={providerMenuItems(router, t)}
      heroLabel={t('messagesSubtitleProvider') || 'Provider Messages'}
      subtitleFallback={t('conversationsTitle')}
    />
  );
}
