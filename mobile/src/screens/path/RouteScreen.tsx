import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { RouteScreenNavigationProp } from '@/navigation/types';
import { useStyles, Theme } from '@/theme';
import { useAuth } from '@/auth/AuthContext';
import { AppHeader } from '@/components/common/AppHeader';
import { MenuActionCard } from '@/components/common/MenuActionCard';
import { ScreenHeader } from '@/components/common/ScreenHeader';

export const RouteScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const navigation = useNavigation<RouteScreenNavigationProp>();

  const { isGuest, user, cerrarSesion, irAAutenticacion } = useAuth();
    
  const handleLogout = () => {
    cerrarSesion();
  };

  const handleNewRoute = () => {
    navigation.navigate('NewRoute');
  };

  const handleMyRoutes = () => {
    navigation.navigate('MyRoutes');
  };

  const handleMyPlaces = () => {
    navigation.navigate('MyPlaces');
  };

  const handleRegister = () => {
    irAAutenticacion();//Envíamos al usuario a registrar/iniciar sesión
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header con inicial y color dinámico */}
      <AppHeader
        userInitial={isGuest ? 'A' : (user?.nombre?.[0]?.toUpperCase() || 'U')}
        isGuest={isGuest}
        onLogout={handleLogout}
      />

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >

        {/* Sección de Encabezado */}
        <ScreenHeader
          eyebrow="TU CIUDAD, A TU MANERA"
          title="Recorridos"
          description="Encontrá rutas accesibles o volvé rápidamente a tus recorridos frecuentes."
        />

        {/* Lista de Acciones */}
        <View style={styles.cardsSection}>
          {/* Nuevo recorrido: siempre visible tanto para registrado como para invitado */}
          <MenuActionCard
            title="NUEVO RECORRIDO"
            subtitle="Busca una ruta accesible"
            iconName="add"
            onPress={handleNewRoute}
            accessibilityLabel="Nuevo recorrido. Busca una ruta accesible"
            accessibilityHint="Toca dos veces para crear una nueva ruta accesible"
          />

          {isGuest ? (
            /* BANNER INFORMATIVO PARA VISITANTES */
            <View
              style={styles.guestCard}
              accessible={true}
              accessibilityRole="summary"
              accessibilityLabel="Creá una cuenta para guardar tus lugares y recorridos frecuentes."
            >
              <Text style={styles.guestCardText}>
                Creá una cuenta para guardar tus lugares y recorridos frecuentes.
              </Text>

              <TouchableOpacity
                style={styles.createAccountButton}
                onPress={handleRegister}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Crear cuenta"
                accessibilityHint="Abre el formulario para registrar una cuenta nueva"
              >
                <Text style={styles.createAccountText}>Crear cuenta</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ACCIONES PARA USUARIOS REGISTRADOS */
            <>
              <MenuActionCard
                title="MIS RECORRIDOS"
                subtitle="Tus destinos frecuentes"
                iconName="star"
                onPress={handleMyRoutes}
                accessibilityLabel="Mis recorridos. Tus destinos frecuentes"
                accessibilityHint="Toca dos veces para ver tu lista de rutas guardadas"
              />

              <MenuActionCard
                title="MIS LUGARES"
                subtitle="Administrá tus lugares guardados"
                iconName="location"
                onPress={handleMyPlaces}
                accessibilityLabel="Mis lugares. Administrá tus lugares guardados"
                accessibilityHint="Toca dos veces para ver y administrar tus sitios guardados"
              />
            </>
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
  contentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
  },
  backButton: {
    width: theme.metrics.minTouch,
    height: theme.metrics.minTouch,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  cardsSection: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },

  // Estilos del Banner de Invitado
  guestCard: {
    backgroundColor: theme.colors.surface.subtle,
    borderRadius: theme.metrics.radius.card,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center' as const,
    marginTop: theme.spacing.lg,
  },
  guestCardText: {
    fontSize: theme.metrics.font.body.size,
    lineHeight: theme.metrics.font.body.lineHeight,
    color: theme.colors.brand.navy,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.lg,
    maxWidth: 260,
    fontWeight: '500' as const,
  },
  createAccountButton: {
    backgroundColor: theme.colors.brand.white,
    borderWidth: theme.metrics.borderWidth.thin, 
    borderRadius: 14,
    paddingVertical: theme.spacing.md - 2,
    paddingHorizontal: theme.spacing.xl * 1.5,
    minHeight: theme.metrics.minTouch,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  createAccountText: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
  },
});