import { Redirect } from 'expo-router';

// Root redirect — actual auth gate is in _layout.jsx
export default function Index() {
  return <Redirect href="/(auth)/sign-in" />;
}
