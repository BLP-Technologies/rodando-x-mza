import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { FormInput } from '@/components/common/FormInput';
import { TutorialCard, TutorialItem } from '@/components/tutorials/TutorialCard';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TutorialsStackParamList } from '@/navigation/types';


// Definimos tipo específico para esta pantalla
type TutorialsScreenNavProp = NativeStackNavigationProp<
  TutorialsStackParamList,
  'TutorialsList'
>;


const TUTORIALS_DATA: TutorialItem[] = [
  {
    id: '1',
    title: 'Moverse por la ciudad',
    category: 'Movilidad urbana',
    duration: '3 min',
    description:
      'Cómo resolver cordones y desniveles con asistencia y priorizando la seguridad',
    iconName: 'share-social-outline',
  },
  {
    id: '2',
    title: 'Moverse por la ciudad',
    category: 'Movilidad urbana',
    duration: '3 min',
    description:
      'Técnicas de balance y uso de rampas pronunciadas en veredas céntricas',
    iconName: 'navigate-outline',
  },
  {
    id: '3',
    title: 'Transporte público accesible',
    category: 'Mendotran',
    duration: '4 min',
    description:
      'Identificación de unidades adaptadas, uso de rampas eléctricas y paradas designadas',
    iconName: 'bus-outline',
  },
];

export const TutorialsScreen = () => {
  const { styles } = useStyles(getStyles);
  const navigation = useNavigation<TutorialsScreenNavProp>();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => console.log('Cerrar sesión');

  const filteredTutorials = TUTORIALS_DATA.filter((tutorial) =>
    tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutorial.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutorial.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenTutorial = (tutorial: TutorialItem) => {
   navigation.navigate('TutorialDetail', { tutorial });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header institucional */}
      <AppHeader userInitial="C" onLogout={handleLogout} />

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
        <View style={styles.prototypeBanner}>
          <Text style={styles.prototypeText}>
            Contenido de referencia para el prototipo. Los tutoriales definitivos
            serán validados con referentes especializados indicaciones
          </Text>
        </View>

        {/* 4. Campo de búsqueda usando FormInput */}
        <FormInput
          label="BUSCAR TUTORIAL"
          placeholder="¿Qué necesitás aprender?"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* 5. Lista de tarjetas */}
        <View style={styles.cardsList}>
          {filteredTutorials.map((item) => (
            <TutorialCard
              key={item.id}
              item={item}
              onPress={() => handleOpenTutorial(item)}
            />
          ))}

          {filteredTutorials.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No se encontraron tutoriales que coincidan con la búsqueda.
              </Text>
            </View>
          )}
        </View>
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
    paddingBottom: 130, // Despeje para la barra inferior
  },
  prototypeBanner: {
    backgroundColor: theme.colors.surface.subtle, // Tono menta del diseño
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