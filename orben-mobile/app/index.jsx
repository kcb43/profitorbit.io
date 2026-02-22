import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    let sub;
    import('../src/services/orbenApi')
      .then(({ supabase }) => {
        supabase.auth.getSession()
          .then(({ data: { session } }) => setSession(session ?? null))
          .catch(() => setSession(null));

        const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
          setSession(sess ?? null);
        });
        sub = listener.subscription;
      })
      .catch(() => setSession(null));

    return () => sub?.unsubscribe();
  }, []);

  // Still checking — show spinner
  if (session === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)/dashboard' : '/(auth)/sign-in'} />;
}
