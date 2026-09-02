import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { radius, space, text } from '@/constants/design';

export default function ModalScreen() {
  const c = usePremiumColors();

  return (
      <View style={[styles.container, { backgroundColor: c.bg }]}>
        <Text style={[styles.title, { color: c.textPrimary }]}>About Diaspora Bridge</Text>
        <View style={[styles.separator, { backgroundColor: c.border }]} />

        <Text style={[styles.info, { color: c.textSecondary }]}>
          Connecting the diaspora with trusted local providers for seamless construction projects.
        </Text>

        <StatusBar style={c.isDark ? 'light' : 'dark'} />

        <Link href="../" style={styles.link}>
          <Text style={[styles.linkText, { color: c.gold }]}>Close Info</Text>
        </Link>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  title: text.display,
  separator: {
    marginVertical: space.xl,
    height: 1,
    width: '80%',
    borderRadius: radius.pill,
  },
  info: {
    ...text.body,
    textAlign: 'center',
    marginBottom: space.xl,
    lineHeight: 24,
  },
  link: {
    paddingVertical: space.md,
  },
  linkText: {
    ...text.body,
    fontWeight: '800',
  }
});
