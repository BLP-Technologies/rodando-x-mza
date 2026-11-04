import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@/theme';
import { BottomTabNavigator } from '@/navigation/BottomTabNavigator';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { RootStackParamList } from '@/navigation/types';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AuthFlow } from './src/auth/AuthFlow';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const theme = useTheme();

  return (
    <NavigationContainer>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
        <Stack.Screen name="Perfil" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Sin sesión se muestra el flujo de auth; con sesión (usuario o invitado), la navegación principal
const Root = () => {
  const { sesion } = useAuth();

  return sesion === null ? <AuthFlow /> : <AppNavigator />;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
