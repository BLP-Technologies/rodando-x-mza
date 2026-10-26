import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RouteStackParamList } from './types';
import { RouteScreen } from '@/screens/path/RouteScreen';
import { MyRoutesScreen } from '@/screens/path/MyRoutesScreen';
import { MyPlacesScreen } from '@/screens/path/MyPlacesScreens';
import { NewRouteScreen } from '@/screens/path/NewRouteScreens';
import { RouteResultScreen } from '@/screens/path/RouteResultScreen';
import { RouteDetailScreen } from '@/screens/path/RouteDetailScreen';
import { PlaceFormScreen } from '@/screens/path/PlaceFormScreen';


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
      <Stack.Screen name="NewRoute" component={NewRouteScreen} />
      <Stack.Screen name="RouteResult" component={RouteResultScreen} />
      <Stack.Screen name="RouteDetail" component={RouteDetailScreen} />
      <Stack.Screen name="CreatePlace" component={PlaceFormScreen} options={{ headerShown: false }}/>
      <Stack.Screen name="EditPlace" component={PlaceFormScreen} options={{ headerShown: false }}/>
    </Stack.Navigator>
  );
};