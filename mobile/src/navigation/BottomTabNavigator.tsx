import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { BottomTabParamList } from './types';

//screens
import { HomeScreen } from '@/screens/home/HomeScreen';
import { ReportStackNavigator } from './ReportStackNavigator';
import { RouteStackNavigator } from '@/navigation/RootStackNavigator';
import { TutorialsScreen } from '@/screens/tutorials/TutorialsScreens';
import { TutorialsStackNavigator } from './TutorialsStackNavigator';


const Tab = createBottomTabNavigator<BottomTabParamList>();

export const BottomTabNavigator = () => {
  const { styles, theme } = useStyles(getStyles);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ focused }) => {
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

          const cardBackground = focused
            ? theme.colors.brand.orange
            : theme.colors.surface.welcome;

          return (
            <View
              style={[
                styles.tabCard,
                { backgroundColor: cardBackground },
              ]}
            >
              <Ionicons
                name={iconName}
                size={24}
                color={theme.colors.brand.navy}
              />
              <Text style={styles.tabLabel}>
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
        options={{
          tabBarLabel: 'Inicio',
          tabBarAccessibilityLabel: 'Pestaña Inicio',
        }}
      />
      <Tab.Screen
        name="Recorrido"
        component={RouteStackNavigator}
        options={{
          tabBarLabel: 'Recorrido',
          tabBarAccessibilityLabel: 'Pestaña Recorrido',
        }}
      />
      <Tab.Screen
        name="Reportar"
        component={ReportStackNavigator}
        options={{
          tabBarLabel: 'Reportes',
          tabBarAccessibilityLabel: 'Pestaña Lista de reportes',
        }}
      />
      <Tab.Screen
        name="Tutoriales"
        component={TutorialsStackNavigator}
        options={{
          tabBarLabel: 'Tutoriales',
          tabBarAccessibilityLabel: 'Pestaña Lista de tutoriales',
        }}
      />
    </Tab.Navigator>
  );
};

const getStyles = (theme: Theme) => ({
  center: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.surface.background,
  },
  mockText: {
    color: theme.colors.text.main,
    fontSize: theme.metrics.font.body.size,
    lineHeight: theme.metrics.font.body.lineHeight,
  },
  tabBar: {
    height: 90,
    paddingBottom: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
  },
  tabBarItem: {
    padding: theme.spacing.xs,
    minHeight: theme.metrics.minTouch,
  },
  tabCard: {
    width: 80,
    height: 64,
    borderRadius: theme.spacing.lg, // 16
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm + 2, // 10
  },
  tabLabel: {
    fontSize: theme.metrics.font.caption.size - 1, // 12
    fontWeight: '600' as const,
    color: theme.colors.brand.navy,
  },
});