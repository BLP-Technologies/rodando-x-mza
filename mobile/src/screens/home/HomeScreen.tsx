import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { MenuActionCard } from '@/components/common/MenuActionCard';


type NavigationProp = BottomTabNavigationProp<BottomTabParamList, 'Inicio'>;

export const HomeScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<NavigationProp>();

  const handleLogout = () => {
    // Llamada al método logout() de AuthContext cuando esté integrado
    console.log('Cerrar sesión');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >

        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title="¡Hola, Ciro! 👋"
          description="¿A dónde querés ir hoy?"
          showBackButton={false}
        />

        {/* Tarjetas de Navegación Rápida */}
        <View style={styles.cardsSection}>
          <MenuActionCard
            title="RECORRIDOS ACCESIBLES"
            subtitle="Encontrá el mejor camino"
            iconName="search"
            onPress={() => navigation.navigate('Recorrido', { screen: 'Recorridos' })}
          />

          <MenuActionCard
            title="REPORTAR UNA BARRERA"
            subtitle="Ayudá a mejorar la ciudad"
            iconName="alert-circle"
            onPress={() => navigation.navigate('Reportar')}
          />

          <MenuActionCard
            title="TUTORIALES"
            subtitle="Consejos para tu autonomía"
            iconName="play"
            onPress={() => navigation.navigate('Tutoriales')}
          />
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
  contentContainer: {
    paddingHorizontal: theme.spacing.xl, // 20
    paddingTop: theme.spacing.lg,        // 16
    paddingBottom: 130  //theme.spacing.xxl,    // 24
  },
  cardsSection: {
    marginTop: theme.spacing.sm, // 8
    gap: theme.spacing.md,
  },
});