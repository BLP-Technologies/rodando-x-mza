import React, { useState, useEffect, useCallback, ComponentProps} from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStyles, Theme } from '@/theme';
import { useAuth } from '@/auth/AuthContext';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { FormInput } from '@/components/common/FormInput';
import { TutorialCard, TutorialItem } from '@/components/tutorials/TutorialCard';
import { tutorialsService } from '@/services/tutorialServices';
import { Tutorial } from '@/types/tutorials';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TutorialsStackParamList } from '@/navigation/types';
import { Ionicons } from '@expo/vector-icons';

type TutorialsScreenNavProp = NativeStackNavigationProp<
  TutorialsStackParamList,
  'TutorialsList'
>;

type IconGlyph = ComponentProps<typeof Ionicons>['name'];


// Asigna un ícono representativo según la categoría o título
const getTutorialIcon = (category: string = ''): IconGlyph => {
  const cat = category.toLowerCase();
  if (cat.includes('movilidad') || cat.includes('urbana')) return 'navigate-outline';
  if (cat.includes('mantenimiento')) return 'construct-outline';
  if (cat.includes('seguridad')) return 'shield-checkmark-outline';
  if (cat.includes('autonomía') || cat.includes('autonomia')) return 'body-outline';
  return 'play-circle-outline';
};

export const TutorialsScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<TutorialsScreenNavProp>();
  
  const [tutorials, setTutorials] = useState<TutorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { isGuest, user, cerrarSesion } = useAuth();
  const handleLogout = () => cerrarSesion();

  // Carga asíncrona mediante tutorialsService
  const loadTutorials = useCallback(async () => {
    try {
      setLoading(true);
      const data: Tutorial[] = await tutorialsService.getAll();
      
      // Adaptar el contrato del backend/mock al formato que espera TutorialCard
      const mapped: TutorialItem[] = data.map((t) => ({
        id: String(t.id),
        title: t.title,
        category: t.category || 'General',
        duration: t.duration || '5 min',
        description: t.description,
        youtubeId: t.youtubeId,
        iconName: getTutorialIcon(t.category),
      }));

      setTutorials(mapped);
    } catch (error) {
      console.error('Error cargando tutoriales:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTutorials();
  }, [loadTutorials]);

  const filteredTutorials = tutorials.filter((tutorial) =>
    tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutorial.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutorial.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

const handleOpenTutorial = (tutorial: TutorialItem) => {
  // Pasamos el tutorial seleccionado como parámetro de navegación
  navigation.navigate('TutorialDetail', { tutorial });
};

  const userInitial = isGuest
    ? 'A'
    : user?.nombre?.[0]?.toUpperCase() || 'U';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header institucional */}
      <AppHeader
        userInitial={userInitial}
        isGuest={isGuest}
        onLogout={handleLogout}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 2. Encabezado común reutilizable */}
        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title="Tutoriales"
          description="Consejos y técnicas para moverte con mayor autonomía."
          showBackButton={true}
        />

        {/* 3. Banner de aviso de prototipo */}
        <View 
          style={styles.prototypeBanner}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel="Aviso de prototipo: Contenido de referencia. Los tutoriales definitivos serán validados con referentes especializados."
        >
          <Text style={styles.prototypeText}>
            Contenido de referencia para el prototipo. Los tutoriales definitivos
            serán validados con referentes especializados.
          </Text>
        </View>

        {/* 4. Campo de búsqueda usando FormInput */}
        <FormInput
          label="BUSCAR TUTORIAL"
          placeholder="¿Qué necesitás aprender?"
          value={searchQuery}
          onChangeText={setSearchQuery}
          multiline={false}
          numberOfLines={1}
          enableVoiceInput={true}
        />

        {/* 5. Estado de carga o Lista de tarjetas */}
        {loading ? (
          <View 
            style={styles.loadingContainer}
            accessible={true}
            accessibilityRole="progressbar"
            accessibilityLabel="Cargando tutoriales disponibles"
          >
            <ActivityIndicator size="large" color={theme.colors.brand.navy} />
            <Text style={styles.loadingText}>Cargando tutoriales...</Text>
          </View>
        ) : (
          <View 
            style={styles.cardsList}
            accessible={true}
            accessibilityRole="list"
            accessibilityLabel="Lista de tutoriales disponibles"
          >
            {filteredTutorials.map((item) => (
              <TutorialCard
                key={item.id}
                item={item}
                onPress={() => handleOpenTutorial(item)}
              />
            ))}

            {filteredTutorials.length === 0 && (
              <View 
                style={styles.emptyContainer}
                accessible={true}
                accessibilityRole="text"
                accessibilityLiveRegion="polite" 
              >
                <Text style={styles.emptyText}>
                  No se encontraron tutoriales que coincidan con la búsqueda.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: Theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface.welcome,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: 130,
  },
  prototypeBanner: {
    backgroundColor: theme.colors.surface.subtle,
    borderRadius: theme.metrics.radius.card - 4,
    borderLeftWidth: theme.spacing.xs,
    borderLeftColor: theme.colors.brand.navy,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  prototypeText: {
    fontSize: theme.metrics.font.caption.size + 0.5,
    lineHeight: 18,
    color: theme.colors.brand.navy,
    fontWeight: '500' as const,
  },
  cardsList: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  loadingContainer: {
    paddingVertical: theme.spacing.xxl * 2,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  loadingText: {
    fontSize: theme.metrics.font.caption.size,
    color: theme.colors.text.muted,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center' as const,
  },
  emptyText: {
    fontSize: theme.metrics.font.body.size,
    color: theme.colors.text.muted,
    textAlign: 'center' as const,
  },
});




// import React, { useState } from 'react';
// import { View, Text, ScrollView, Alert } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { useStyles, Theme } from '@/theme';
// import { useAuth } from '@/auth/AuthContext';
// import { AppHeader } from '@/components/common/AppHeader';
// import { ScreenHeader } from '@/components/common/ScreenHeader';
// import { FormInput } from '@/components/common/FormInput';
// import { TutorialCard, TutorialItem } from '@/components/tutorials/TutorialCard';
// import { useNavigation } from '@react-navigation/native';
// import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { TutorialsStackParamList } from '@/navigation/types';


// // Definimos tipo específico para esta pantalla
// type TutorialsScreenNavProp = NativeStackNavigationProp<
//   TutorialsStackParamList,
//   'TutorialsList'
// >;


// const TUTORIALS_DATA: TutorialItem[] = [
//   {
//     id: '1',
//     title: 'Moverse por la ciudad',
//     category: 'Movilidad urbana',
//     duration: '3 min',
//     description:
//       'Cómo resolver cordones y desniveles con asistencia y priorizando la seguridad',
//     iconName: 'share-social-outline',
//   },
//   {
//     id: '2',
//     title: 'Moverse por la ciudad',
//     category: 'Movilidad urbana',
//     duration: '3 min',
//     description:
//       'Técnicas de balance y uso de rampas pronunciadas en veredas céntricas',
//     iconName: 'navigate-outline',
//   },
//   {
//     id: '3',
//     title: 'Transporte público accesible',
//     category: 'Mendotran',
//     duration: '4 min',
//     description:
//       'Identificación de unidades adaptadas, uso de rampas eléctricas y paradas designadas',
//     iconName: 'bus-outline',
//   },
// ];

// export const TutorialsScreen = () => {
//   const { styles } = useStyles(getStyles);
//   const navigation = useNavigation<TutorialsScreenNavProp>();
//   const [searchQuery, setSearchQuery] = useState('');

//   // Consumo de la sesión real
//   const { isGuest, user, cerrarSesion } = useAuth();

//   const handleLogout = () => cerrarSesion();

//   const filteredTutorials = TUTORIALS_DATA.filter((tutorial) =>
//     tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
//     tutorial.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
//     tutorial.category.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   const handleOpenTutorial = (tutorial: TutorialItem) => {
//    navigation.navigate('TutorialDetail', { tutorial });
//   };

//   const userInitial = isGuest
//     ? 'A'
//     : user?.nombre?.[0]?.toUpperCase() || 'U';

//   return (
//     <SafeAreaView style={styles.safeArea} edges={['top']}>
//       {/* 1. Header institucional */}
//       <AppHeader
//         userInitial={userInitial}
//         isGuest={isGuest}
//         onLogout={handleLogout}
//       />
//       <ScrollView
//         style={styles.scrollView}
//         contentContainerStyle={styles.contentContainer}
//         showsVerticalScrollIndicator={false}
//         keyboardShouldPersistTaps="handled"
//       >
//         {/* 2. Encabezado común reutilizable */}
//         <ScreenHeader
//           eyebrow="TU CIUDAD, A TU MANERA"
//           title="Tutoriales"
//           description="Consejos y técnicas para moverte con mayor autonomía."
//           showBackButton={true}
//         />

//         {/* 3. Banner de aviso de prototipo */}
//         <View 
//           style={styles.prototypeBanner}
//           accessible={true}
//           accessibilityRole="text"
//           accessibilityLabel="Aviso de prototipo: Contenido de referencia. Los tutoriales definitivos serán validados con referentes especializados."
//         >
//           <Text style={styles.prototypeText}>
//             Contenido de referencia para el prototipo. Los tutoriales definitivos
//             serán validados con referentes especializados indicaciones
//           </Text>
//         </View>

//         {/* 4. Campo de búsqueda usando FormInput */}
//         <FormInput
//           label="BUSCAR TUTORIAL"
//           placeholder="¿Qué necesitás aprender?"
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//           multiline={false}
//           numberOfLines={1}
//           enableVoiceInput={true}
//         />

//         {/* 5. Lista de tarjetas */}
//         <View 
//           style={styles.cardsList}
//           accessible={true}
//           accessibilityRole="list"
//           accessibilityLabel="Lista de tutoriales disponibles"
//         >
//           {filteredTutorials.map((item) => (
//             <TutorialCard
//               key={item.id}
//               item={item}
//               onPress={() => handleOpenTutorial(item)}
//             />
//           ))}

//           {filteredTutorials.length === 0 && (
//             <View 
//               style={styles.emptyContainer}
//               accessible={true}
//               accessibilityRole="text"
//               accessibilityLiveRegion="polite" 
//             >
//               <Text style={styles.emptyText}>
//                 No se encontraron tutoriales que coincidan con la búsqueda.
//               </Text>
//             </View>
//           )}
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// const getStyles = (theme: Theme) => ({
//   safeArea: {
//     flex: 1,
//     backgroundColor: theme.colors.surface.welcome,
//   },
//   scrollView: {
//     flex: 1,
//   },
//   contentContainer: {
//     paddingHorizontal: theme.spacing.xl,
//     paddingTop: theme.spacing.md,
//     paddingBottom: 130, // Despeje para la barra inferior
//   },
//   prototypeBanner: {
//     backgroundColor: theme.colors.surface.subtle, // Tono menta del diseño
//     borderRadius: theme.metrics.radius.card - 4,
//     borderLeftWidth: theme.spacing.xs,
//     borderLeftColor: theme.colors.brand.navy,
//     paddingVertical: theme.spacing.md,
//     paddingHorizontal: theme.spacing.lg,
//     marginBottom: theme.spacing.xl,
//   },
//   prototypeText: {
//     fontSize: theme.metrics.font.caption.size + 0.5,
//     lineHeight: 18,
//     color: theme.colors.brand.navy,
//     fontWeight: '500' as const,
//   },
//   cardsList: {
//     marginTop: theme.spacing.md,
//     gap: theme.spacing.md,
//   },
//   emptyContainer: {
//     paddingVertical: theme.spacing.xxl,
//     alignItems: 'center' as const,
//   },
//   emptyText: {
//     fontSize: theme.metrics.font.body.size,
//     color: theme.colors.text.muted,
//     textAlign: 'center' as const,
//   },
// });