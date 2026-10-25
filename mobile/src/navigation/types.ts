import type { NavigatorScreenParams, CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';



//Definición de tipos de Parámetros de distintas pantallas
// 1. Para la pantalla RouteResult
export type RoutePointParam = {
  label: string;
  latitude: number;
  longitude: number;
};

//2. Para la pantalla Tutoriales
export type TutorialParams = {
  id: string;
  title: string;
  category: string;
  duration: string;
  description: string;
  youtubeId?: string;
};


//______________________________________________________________________
// Para mantener visible el Bottom Tab: Pantallas dentro de los flujos 
// internos de los screens principales
// 1. Recorrido
export type RouteStackParamList = {
  Recorridos: undefined;
  MyPlaces: undefined;
  MyRoutes: undefined;
  NewRoute: undefined;
  RouteResult: {
    origin: RoutePointParam;
    destination: RoutePointParam;
  };
};

// 2. Reportar
export type ReportStackParamList = {
  ReportForm: undefined;
  ConfirmReport: ReportDataParams;
};

// 3. Tutoriales
export type TutorialsStackParamList = {
  TutorialsList: undefined;
  TutorialDetail: { tutorial: TutorialParams };
};

//_______________________________________________________________________
// Pantallas de la barra inferior de navegación
export type BottomTabParamList = {
  Inicio: undefined;
  Recorrido: NavigatorScreenParams<RouteStackParamList> | undefined;
  Reportar: NavigatorScreenParams<ReportStackParamList> | undefined;
  Tutoriales: NavigatorScreenParams<TutorialsStackParamList> |undefined;
};


//_______________________________________________________________________
// Stack raíz para pantallas modales o completas (sin Bottom Tab)
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<BottomTabParamList> | undefined;
  ReportDetail: { reportId: string };
  NewReport: { latitude: number; longitude: number };
};



//_______________________________________________________________________
// Parámetros que se envían a ReportDetailScreen
export interface ReportDataParams {
  locationMode: 'current' | 'map';
  barrierId: string;
  barrierLabel: string;
  photoUri: string | null;
  description: string;
}

//______________________________________________________________________
// Tipos compuestos para facilitar el tipado en hooks useNavigation:
//1. Para usar dentro de HomeScreen
export type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'Inicio'>,
  NativeStackNavigationProp<RootStackParamList>
>;

//2. Para usar dentro de RouteScreen y MyPlacesScreen
export type RouteScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RouteStackParamList, 'Recorridos'>,
  BottomTabNavigationProp<BottomTabParamList>
>;

//3. Para ReportsScreen (para goBack o saltar entre tabs)
export type ReportsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'Reportar'>,
  NativeStackNavigationProp<RootStackParamList>
>;

