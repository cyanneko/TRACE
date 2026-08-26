import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>TRACE</Text>
      <Text style={styles.subtitle}>Thread Reasoning, Action, Context & Execution</Text>
      <Text style={styles.status}>Workspace ready</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    color: '#17211b',
    fontSize: 34,
    fontWeight: '700',
  },
  subtitle: {
    color: '#445148',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  status: {
    color: '#137a4b',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 24,
  },
});
