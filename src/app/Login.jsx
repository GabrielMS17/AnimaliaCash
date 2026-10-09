import { useRouter } from 'expo-router';
import LoginScreen from '../services/screens/possivelLogin';

export default function Login() {
  const router = useRouter();

  return <LoginScreen onLoginSuccess={() => router.replace('/')} />;
}
