// src/navigation/ReportStackNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReportStackParamList } from './types';
import { ReportsScreen } from '@/screens/reports/ReportsScreen';
import { ConfirmReportScreen } from '@/screens/reports/ConfirmReportScreen';

const Stack = createNativeStackNavigator<ReportStackParamList>();

export const ReportStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="ReportForm" component={ReportsScreen} />
      <Stack.Screen name="ConfirmReport" component={ConfirmReportScreen} />
    </Stack.Navigator>
  );
};