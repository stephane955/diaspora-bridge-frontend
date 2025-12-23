import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

export default function ModalScreen() {
  return (
      <View style={styles.container}>
        <Text style={styles.title}>About Diaspora Bridge</Text>
        <View style={styles.separator} />

        <Text style={styles.info}>
          Connecting the diaspora with trusted local providers for seamless construction projects.
        </Text>

        {/* Use a light status bar on iOS to account for the modal presentation */}
        <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />

        <Link href="../" style={styles.link}>
          <Text style={styles.linkText}>Close Info</Text>
        </Link>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
    backgroundColor: '#E2E8F0',
  },
  info: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  link: {
    paddingVertical: 15,
  },
  linkText: {
    color: '#0EA5E9',
    fontSize: 16,
    fontWeight: 'bold',
  }
});