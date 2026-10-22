import type { NavigatorScreenParams, CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// 1. Pantallas dentro del flujo interno de Recorridos (mantienen visible el Bottom Tab)
export type RouteStackParamList = {
  RouteHome: undefined;
  MyPlaces: undefined;
  MyRoutes: undefined, 
  // NewRoute: undefined
};

// 2. Pantallas de la barra inferior de navegación
export type BottomTabParamList = {
  Inicio: undefined;
  Recorrido: NavigatorScreenParams<RouteStackParamList> | undefined;
  Reportar: undefined;
  Tutoriales: undefined;
};

// 3. Stack raíz para pantallas modales o completas (sin Bottom Tab)
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<BottomTabParamList> | undefined;
  ReportDetail: { reportId: string };
  NewReport: { latitude: number; longitude: number };
};

// Tipos compuestos para facilitar el tipado en hooks useNavigation:

// Para usar dentro de HomeScreen
export type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'Inicio'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// Para usar dentro de RouteScreen y MyPlacesScreen
export type RouteScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RouteStackParamList>,
  BottomTabNavigationProp<BottomTabParamList>
>;