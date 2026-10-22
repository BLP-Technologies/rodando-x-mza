// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@/theme';
import { BottomTabNavigator } from '@/navigation/BottomTabNavigator';
import { MyPlacesScreen } from '@/screens/path/MyPlacesScreens';
import { RootStackParamList } from '@/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const theme = useTheme();

  return (
    <NavigationContainer>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}