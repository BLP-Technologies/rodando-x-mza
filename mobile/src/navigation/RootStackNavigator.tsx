import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RouteStackParamList } from './types';
import { RouteScreen } from '@/screens/path/RouteScreen';
import { MyRoutesScreen } from '@/screens/path/MyRoutesScreen';
import { MyPlacesScreen } from '@/screens/path/MyPlacesScreens';
// import { ReportsScreen } from'@/screens/reports/ReportsScreen';
import { NewRouteScreen } from '@/screens/path/NewRouteScreens';
import { RouteResultScreen } from '@/screens/path/RouteResultScreen';

const Stack = createNativeStackNavigator<RouteStackParamList>();

export const RouteStackNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Recorridos"
      screenOptions={{ 
        headerShown: false, 
        animation: 'slide_from_right' 
      }}
    >
      <Stack.Screen name="Recorridos" component={RouteScreen} />
      <Stack.Screen name="MyRoutes" component={MyRoutesScreen} />
      <Stack.Screen name="MyPlaces" component={MyPlacesScreen} />
      {/* <Stack.Screen name="Reports" component={ReportsScreen} /> */}
      <Stack.Screen name="NewRoute" component={NewRouteScreen} />
      <Stack.Screen name="RouteResult" component={RouteResultScreen} />

    </Stack.Navigator>
  );
};