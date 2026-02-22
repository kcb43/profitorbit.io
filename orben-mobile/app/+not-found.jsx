import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function NotFound() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Page Not Found</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.replace('/')}>
        <Text style={styles.btnText}>Go Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 24 },
  btn: { backgroundColor: '#1a73e8', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
