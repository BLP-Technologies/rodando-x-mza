import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { useAuth } from '@/auth/AuthContext';
import { AppHeader } from '@/components/common/AppHeader';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { MenuActionCard } from '@/components/common/MenuActionCard';
import { StatusModal } from '@/components/common/StatusModal';


type NavigationProp = BottomTabNavigationProp<BottomTabParamList, 'Inicio'>;

export const HomeScreen = () => {
  const { styles } = useStyles(getStyles);
  const navigation = useNavigation<NavigationProp>();

  // Consumo de la sesión real
  const { isGuest, user, cerrarSesion, irAAutenticacion } = useAuth();

  // Control de visibilidad del modal de bloqueo de reporte
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  const handleLogout = () => {
    cerrarSesion();
  };

  const handlePressReport = () => {
    if (isGuest) {
      setShowAuthModal(true);
      return;
    }
    navigation.navigate('Reportar');
  };


  // Avatar e inicial: 'A' en naranja para visitante o primera letra del nombre registrado
  const userInitial = isGuest
    ? 'A'
    : user?.nombre?.[0]?.toUpperCase() || 'U';

  // Saludo condicional
  const greetingTitle = isGuest || !user?.nombre
    ? '¡Hola, Invitado! 👋'
    : `¡Hola, ${user.nombre}! 👋`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
            <AppHeader
              userInitial={userInitial}
              isGuest={isGuest}
              onLogout={handleLogout}
            />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >

        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title={greetingTitle}
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
            accessibilityLabel="Recorridos accesibles. Encontrá el mejor camino"
            accessibilityHint="Navega a la sección para buscar o planificar trayectos accesibles"
          />

          <MenuActionCard
            title="REPORTAR UNA BARRERA"
            subtitle="Ayudá a mejorar la ciudad"
            iconName="alert-circle"
            onPress={handlePressReport}
            accessibilityLabel="Reportar una barrera. Ayudá a mejorar la ciudad"
            accessibilityHint="Abre el formulario para informar obstáculos o veredas intransitables"
          />

          <MenuActionCard
            title="TUTORIALES"
            subtitle="Consejos para tu autonomía"
            iconName="play"
            onPress={() => navigation.navigate('Tutoriales')}
            accessibilityLabel="Tutoriales. Consejos para tu autonomía"
            accessibilityHint={
              isGuest
                ? "Abre advertencia que requiere iniciar sesión para reportar"
                : "Abre el formulario para informar obstáculos o veredas intransitables"
            }
          />
        </View>
      </ScrollView>

      {/* Modal para usuarios invitados al presionar Reportar */}
      <StatusModal
        visible={showAuthModal}
        type="auth"
        title="Para reportar una barrera necesitás una cuenta"
        message="Al iniciar sesión podemos asociar el reporte a tu cuenta y permitir el seguimiento de su estado."
        onClose={() => setShowAuthModal(false)}
        confirmText="CREAR CUENTA"
        onConfirm={() => {
          setShowAuthModal(false);
          irAAutenticacion();
        }}
        secondaryText="INICIAR SESIÓN"
        onSecondary={() => {
          setShowAuthModal(false);
          irAAutenticacion();
        }}
        dismissText="Ahora no"
      />      

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