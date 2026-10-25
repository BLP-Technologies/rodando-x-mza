import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TutorialsStackParamList } from './types';
import { TutorialsScreen } from '@/screens/tutorials/TutorialsScreens';
import { TutorialDetailScreen } from '@/screens/tutorials/TutorialDetailScreen';

const Stack = createNativeStackNavigator<TutorialsStackParamList>();

export const TutorialsStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName="TutorialsList"
    >
      <Stack.Screen name="TutorialsList" component={TutorialsScreen} />
      <Stack.Screen name="TutorialDetail" component={TutorialDetailScreen} />
    </Stack.Navigator>
  );
};