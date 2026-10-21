import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { BottomTabParamList } from './types';
import { useTheme } from '@/theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';


//Screens
import { HomeScreen } from '@/screens/home/HomeScreen';

// Pantallas mockup

const RouteScreen = () => (
  <View style={styles.center}><Text>Recorrido</Text></View>
);
const ReportsScreen = () => (
  <View style={styles.center}><Text>Reportar</Text></View>
);
const TutorialScreen = () => (
  <View style={styles.center}><Text>Tutoriales</Text></View>
);

const Tab = createBottomTabNavigator<BottomTabParamList>();

export const BottomTabNavigator = () => {
  const theme = useTheme();

  //Colores definidos en theme/tokens.ts
  const colorNavy = theme.colors.brand?.navy;
  const colorOrange = theme.colors.brand?.orange;
  const colorWelcome = theme.colors.surface?.welcome;
  const colorCard = theme.colors.surface?.card;
  const colorBorder = theme.colors.border?.default;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 90,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: colorCard,
          borderTopWidth: 1,
          borderTopColor: colorBorder,
        },
        tabBarItemStyle: {
          padding: 4,
          minHeight: theme.metrics.minTouch || 48, // Accesibilidad táctil
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          let labelText = '';

          switch (route.name) {
            case 'Inicio':
              iconName = focused ? 'home' : 'home-outline';
              labelText = 'Inicio';
              break;
            case 'Recorrido':
              iconName = focused ? 'map' : 'map-outline';
              labelText = 'Recorrido';
              break;
            case 'Reportar':
              iconName = focused ? 'alert-circle' : 'alert-circle-outline';
              labelText = 'Reportar';
              break;
            case 'Tutoriales':
              iconName = focused ? 'book' : 'book-outline';
              labelText = 'Tutoriales';
              break;
            default:
              iconName = 'ellipse-outline';
              labelText = '';
          }

          return (
            <View
              style={[
                styles.tabCard,
                {
                  backgroundColor: focused ? colorOrange : colorWelcome,
                },
              ]}
            >
              <Ionicons name={iconName} size={24} color={colorNavy} />
              <Text style={[styles.tabLabel, { color: colorNavy }]}>
                {labelText}
              </Text>
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{ tabBarLabel: 'Inicio', tabBarAccessibilityLabel: 'Pestaña Inicio' }}
      />
      <Tab.Screen
        name="Recorrido"
        component={RouteScreen}
        options={{ tabBarLabel: 'Recorrido', tabBarAccessibilityLabel: 'Pestaña Recorrido' }}
      />
      <Tab.Screen
        name="Reportar"
        component={ReportsScreen}
        options={{ tabBarLabel: 'Reportes', tabBarAccessibilityLabel: 'Pestaña Lista de reportes' }}
      />
      <Tab.Screen
        name="Tutoriales"
        component={TutorialScreen}
        options={{ tabBarLabel: 'Tutoriales', tabBarAccessibilityLabel: 'Pestaña Tutoriales' }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  center: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' },
  tabCard: {
    width: 80,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});