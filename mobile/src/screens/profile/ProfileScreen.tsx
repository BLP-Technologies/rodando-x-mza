import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useStyles,
  Theme,
  useAccessibility,
  FontScaleOption,
} from '@/theme';
import { AppHeader } from '@/components/common/AppHeader';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';

interface UserProfile {
  name: string;
  email: string;
  initial: string;
}

export const ProfileScreen = () => {
  const { styles, theme } = useStyles(getStyles);
  const {
    preferences,
    setHighContrast,
    setFontScale,
    setReduceMotion,
    setReadingGuide,
    setScreenReaderEnabled,
  } = useAccessibility();

  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // --- ESTADO DE AUTENTICACIÓN (Preparado para conectar con AuthContext / compañero) ---
  // Cambiá este valor a false o true para probar ambos estados visuales al instante:
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile>({
    name: 'Ciro',
    email: 'ciroascencio@mail.com',
    initial: 'C',
  });

  const fontScaleLabels: Record<FontScaleOption, string> = {
    normal: 'Normal',
    large: 'Grande',
    extraLarge: 'Extra grande',
  };

  const handleNextFontScale = () => {
    const scales: FontScaleOption[] = ['normal', 'large', 'extraLarge'];
    const currentIndex = scales.indexOf(preferences.fontScale);
    const nextIndex = (currentIndex + 1) % scales.length;
    setFontScale(scales[nextIndex]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader
        userInitial={isAuthenticated ? user.initial : 'B'}
        onLogout={() => setIsAuthenticated((prev) => !prev)} // Simula cerrar sesión o cambiar de estado
      />
      <View style={styles.fixedHeaderContainer}> 
    
        {/* Encabezado */}
          <ScreenHeader
              eyebrow="TU CIUDAD, A TU MANERA"
              title="Perfil"
              showBackButton={true}
          />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================================== */}
        {/* BLOQUE CONDICIONAL: USUARIO AUTENTICADO vs VISITANTE          */}
        {/* ============================================================== */}
        {isAuthenticated ? (
          // CASO 1: USUARIO AUTENTICADO
          <>
            {/* Tarjeta de bienvenida con Avatar y botón Editar datos */}
            <View style={styles.welcomeCard}>
              <View style={styles.userInfoRow}>
                <View style={styles.avatarCircleAuth}>
                  <Text style={styles.avatarAuthText}>{user.initial}</Text>
                </View>

                <View style={styles.userDetailsCol}>
                  <Text style={styles.greetingText}>¡Hola! 👋</Text>
                  <Text style={styles.userNameText}>{user.name}</Text>
                  <Text style={styles.userEmailText}>{user.email}</Text>
                </View>

                <TouchableOpacity
                  style={styles.editDataButton}
                  onPress={() => console.log('Navegar a Editar datos')}
                  accessibilityRole="button"
                  accessibilityLabel="Editar datos personales"
                >
                  <Text style={styles.editDataText}>Editar datos</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tarjeta Cuenta Activa */}
            <View style={styles.activeAccountCard}>
              <View style={styles.activeAccountLeftStripe} />
              <View style={styles.activeAccountContent}>
                <Text style={styles.activeAccountTitle}>✓ Cuenta activa</Text>
                <Text style={styles.activeAccountSubtitle}>
                  Tus datos se guardan en este dispositivo.
                </Text>
              </View>
            </View>
          </>
        ) : (
          // CASO 2: USUARIO VISITANTE (SIN CUENTA)
          <>
            {/* Tarjeta de bienvenida de invitado */}
            <View style={styles.welcomeCard}>
              <View style={styles.userInfoRow}>
                <View style={styles.avatarCircleGuest}>
                  <Text style={styles.avatarGuestText}>B</Text>
                </View>

                <View style={styles.userDetailsCol}>
                  <Text style={styles.greetingText}>¡Hola! 👋</Text>
                  <Text style={styles.userNameText}>B</Text>
                  <Text style={styles.guestStatusText}>
                    Estás usando la aplicación sin cuenta.
                  </Text>
                </View>
              </View>
            </View>

            {/* Banner de llamada a crear cuenta / login */}
            <View style={styles.guestCtaCard}>
              <View style={styles.guestCtaLeftStripe} />
              <Text style={styles.guestCtaTitle}>
                Creá una cuenta para más opciones
              </Text>
              <Text style={styles.guestCtaSubtitle}>
                Podrás guardar tus recorridos, tus lugares favoritos y hacer reportes.
              </Text>
              <View style={styles.guestButtonsRow}>
                <PrimaryButton
                  title="Crear cuenta"
                  variant="teal"
                  onPress={() => console.log('Ir a Registro')}
                  style={styles.authButton}
                />
                <PrimaryButton
                  title="Iniciar sesión"
                  variant="outline"
                  onPress={() => console.log('Ir a Login')}
                  style={styles.authButton}
                />
              </View>
            </View>
          </>
        )}

        {/* ============================================================== */}
        {/* PREFERENCIAS DE ACCESIBILIDAD (Comunes a ambos estados)       */}
        {/* ============================================================== */}
        <Text style={styles.sectionHeader}>Preferencias de accesibilidad</Text>

        <View style={styles.settingsGroup}>
          {/* Lectura en voz alta */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Lectura en voz alta</Text>
              <Text style={styles.settingDescription}>
                Escuchá indicaciones y mensajes importantes.
              </Text>
            </View>
            <Switch
              value={preferences.screenReaderEnabled}
              onValueChange={setScreenReaderEnabled}
              trackColor={{ false: '#D1D5DB', true: theme.colors.brand.teal }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* Modo alto contraste */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Modo alto contraste</Text>
              <Text style={styles.settingDescription}>
                Aumenta el contraste de textos y controles.
              </Text>
            </View>
            <Switch
              value={preferences.highContrast}
              onValueChange={setHighContrast}
              trackColor={{ false: '#D1D5DB', true: theme.colors.brand.teal }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* Tamaño del texto */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Tamaño del texto</Text>
              <Text style={styles.settingDescription}>
                Elegí el tamaño más cómodo.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dropdownBadge}
              onPress={handleNextFontScale}
              accessibilityRole="button"
              accessibilityLabel={`Tamaño actual: ${fontScaleLabels[preferences.fontScale]}. Tocar para cambiar`}
            >
              <Text style={styles.dropdownBadgeText}>
                {fontScaleLabels[preferences.fontScale]}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.colors.brand.navy} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Guía de lectura */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Guía de lectura</Text>
              <Text style={styles.settingDescription}>
                Facilita el seguimiento visual del contenido.
              </Text>
            </View>
            <Switch
              value={preferences.readingGuide}
              onValueChange={setReadingGuide}
              trackColor={{ false: '#D1D5DB', true: theme.colors.brand.teal }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* Reducir movimiento */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={styles.settingTitle}>Reducir movimiento</Text>
              <Text style={styles.settingDescription}>
                Reduce las animaciones de la interfaz.
              </Text>
            </View>
            <Switch
              value={preferences.reduceMotion}
              onValueChange={setReduceMotion}
              trackColor={{ false: '#D1D5DB', true: theme.colors.brand.teal }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Sección: Ayuda */}
        <TouchableOpacity
          style={styles.helpAccordion}
          onPress={() => setIsHelpOpen((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Text style={styles.helpTitle}>Ayuda</Text>
          <Ionicons
            name={isHelpOpen ? 'chevron-up' : 'chevron-forward'}
            size={20}
            color={theme.colors.brand.navy}
          />
        </TouchableOpacity>

        {isHelpOpen && (
          <View style={styles.helpContent}>
            <Text style={styles.helpContentText}>
              Encontrá tutoriales de uso, preguntas frecuentes o comunicate con el equipo de soporte de Rodando x Mza.
            </Text>
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
   fixedHeaderContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    paddingBottom: 130,
  },

  // --- TARJETA DE BIENVENIDA (Común a ambos) ---
  welcomeCard: {
    backgroundColor: '#E8F5F5', // Fondo verde menta/cian suave exacto a las capturas
    borderRadius: theme.metrics.radius.card,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  userInfoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  avatarCircleAuth: {
    width: 48,
    height: 48,
    borderRadius: theme.metrics.radius.pill,
    backgroundColor: '#129B9B',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: theme.spacing.md,
  },
  avatarAuthText: {
    color: '#FFFFFF',
    fontWeight: '800' as const,
    fontSize: 20,
  },
  avatarCircleGuest: {
    width: 48,
    height: 48,
    borderRadius: theme.metrics.radius.pill,
    backgroundColor: '#EA580C',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: theme.spacing.md,
  },
  avatarGuestText: {
    color: '#FFFFFF',
    fontWeight: '800' as const,
    fontSize: 20,
  },
  userDetailsCol: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  greetingText: {
    fontSize: theme.metrics.font.caption.size + 1,
    fontWeight: '800' as const,
    color: '#0D9488',
    marginBottom: 2,
  },
  userNameText: {
    fontSize: theme.metrics.font.title.size + 2,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    lineHeight: 24,
  },
  userEmailText: {
    fontSize: theme.metrics.font.caption.size,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  guestStatusText: {
    fontSize: theme.metrics.font.caption.size - 1,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  editDataButton: {
    borderWidth: 1.5,
    borderColor: '#7AC1C1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  editDataText: {
    fontSize: theme.metrics.font.caption.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
  },

  // --- CASO 1: CUENTA ACTIVA ---
  activeAccountCard: {
    flexDirection: 'row' as const,
    backgroundColor: '#E8F5F5',
    borderRadius: theme.metrics.radius.card - 4,
    overflow: 'hidden' as const,
    marginBottom: theme.spacing.xl,
  },
  activeAccountLeftStripe: {
    width: 6,
    backgroundColor: '#0D9488',
  },
  activeAccountContent: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  activeAccountTitle: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    marginBottom: 4,
  },
  activeAccountSubtitle: {
    fontSize: theme.metrics.font.caption.size,
    color: theme.colors.text.muted,
  },

  // --- CASO 2: INVITADO CTA ---
  guestCtaCard: {
    position: 'relative' as const,
    backgroundColor: '#F3B5BA', // Tono salmón/rosa de la maqueta
    borderRadius: theme.metrics.radius.card - 4,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    overflow: 'hidden' as const,
  },
  guestCtaLeftStripe: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: '#EA580C',
  },
  guestCtaTitle: {
    fontSize: theme.metrics.font.body.size + 1,
    fontWeight: '800' as const,
    color: '#0F2942',
    marginBottom: 6,
    paddingLeft: theme.spacing.xs,
  },
  guestCtaSubtitle: {
    fontSize: theme.metrics.font.caption.size,
    color: '#3B4856',
    lineHeight: 18,
    marginBottom: theme.spacing.lg,
    paddingLeft: theme.spacing.xs,
  },
  guestButtonsRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
  },
  authButton: {
    flex: 1,
  },

  // --- SECCIÓN PREFERENCIAS ---
  sectionHeader: {
    fontSize: theme.metrics.font.header.size - 4,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    marginBottom: theme.spacing.lg,
  },
  settingsGroup: {
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  settingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: theme.spacing.sm,
  },
  settingTextCol: {
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  settingTitle: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '700' as const,
    color: theme.colors.brand.navy,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: theme.metrics.font.caption.size,
    color: theme.colors.text.muted,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border.default,
    marginVertical: theme.spacing.xs,
  },
  dropdownBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.surface.welcome,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  dropdownBadgeText: {
    fontSize: theme.metrics.font.body.size - 2,
    fontWeight: '700' as const,
    color: theme.colors.brand.navy,
  },
  helpAccordion: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  helpTitle: {
    fontSize: theme.metrics.font.body.size + 1,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
  },
  helpContent: {
    backgroundColor: theme.colors.surface.card,
    borderBottomLeftRadius: theme.metrics.radius.card,
    borderBottomRightRadius: theme.metrics.radius.card,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: theme.colors.border.default,
    padding: theme.spacing.lg,
    marginTop: -4,
  },
  helpContentText: {
    fontSize: theme.metrics.font.body.size - 2,
    color: theme.colors.text.muted,
    lineHeight: 18,
  },
});



    
