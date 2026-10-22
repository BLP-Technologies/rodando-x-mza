import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RouteStackParamList } from './types';
import { RouteScreen } from '@/screens/path/RouteScreen';
import { MyPlacesScreen } from '@/screens/path/MyPlacesScreens';

const Stack = createNativeStackNavigator<RouteStackParamList>();

export const RouteStackNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="RouteHome"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="RouteHome" component={RouteScreen} />
      <Stack.Screen name="MyPlaces" component={MyPlacesScreen} />
    </Stack.Navigator>
  );
};