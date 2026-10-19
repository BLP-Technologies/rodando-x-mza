import { StatusBar } from 'expo-status-bar';
import { Bienvenida } from './src/auth/bienvenida';
import { SafeAreaProvider } from 'react-native-safe-area-context';
export default function App() {
  return (
    <SafeAreaProvider>
    <Bienvenida
        onInvitado={() => { }}
        onRegistro={() => { }}
        onLogin={() => { }}
      />
    </SafeAreaProvider>
  );
}
