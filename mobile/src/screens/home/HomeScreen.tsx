import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { BottomTabParamList } from '@/navigation/types';
import { useTheme } from '@/theme/ThemeContext';
import { AppHeader } from '@/components/common/AppHeader';
import { MenuActionCard } from '@/components/common/MenuActionCard';

type NavigationProp = BottomTabNavigationProp<BottomTabParamList, 'Inicio'>;

export const HomeScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const colorNavy = theme.colors.brand?.navy || '#002B49';
  const colorTeal = theme.colors.brand?.teal || '#17A2B8';
  const colorWelcome = theme.colors.surface?.welcome || '#FAF8F5';

  const handleLogout = () => {
    // Acá llamarás al método logout() de tu AuthContext
    console.log('Cerrar sesión');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colorWelcome }]} edges={['top']}>
      <AppHeader userInitial="C" onLogout={handleLogout} />

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Botón Volver */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver atrás"
        >
          <Ionicons name="chevron-back" size={24} color={colorNavy} />
        </TouchableOpacity>

        {/* Sección de Saludo */}
        <View style={styles.greetingContainer}>
          <Text style={[styles.eyebrow, { color: colorTeal }]}>
            TU CIUDAD, A TU MANERA
          </Text>
          <Text style={[styles.greetingTitle, { color: colorNavy }]}>
            ¡Hola, Ciro! 👋
          </Text>
          <Text style={[styles.greetingSubtitle, { color: colorNavy }]}>
            ¿A dónde querés ir hoy?
          </Text>
        </View>

        {/* Tarjetas de Navegación Rápida */}
        <View style={styles.cardsSection}>
          <MenuActionCard
            title="RECORRIDOS ACCESIBLES"
            subtitle="Encontrá el mejor camino"
            iconName="search"
            onPress={() => navigation.navigate('Recorrido')}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 12,
  },
  greetingContainer: {
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  greetingSubtitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  cardsSection: {
    marginTop: 8,
  },
});