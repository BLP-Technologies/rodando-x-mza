import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { searchAddressSuggestions, PlaceSuggestion } from '@/services/geocoding';

interface AddressSearchModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (place: PlaceSuggestion) => void;
}

export const AddressSearchModal = ({
  visible,
  title,
  onClose,
  onSelect,
}: AddressSearchModalProps) => {
  const { styles, theme } = useStyles(getStyles);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Para esperar 350ms antes de consultar la API
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!query.trim() || query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimer.current = setTimeout(async () => {
      const suggestions = await searchAddressSuggestions(query);
      setResults(suggestions);
      setLoading(false);
    }, 350);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query]);

  const handleSelectPlace = (place: PlaceSuggestion) => {
    onSelect(place);
    handleResetAndClose();
  };

  const handleResetAndClose = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setQuery('');
    setResults([]);
    setLoading(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleResetAndClose}
      accessibilityViewIsModal={true}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Cabecera del buscador */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleResetAndClose}
            style={styles.backButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Volver y cerrar búsqueda"
            accessibilityHint="Cierra esta ventana emergente sin seleccionar ninguna dirección"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.brand.navy} />
          </TouchableOpacity>
          <Text 
            style={styles.headerTitle}
            accessible={true}
            accessibilityRole="header"
          >
            {title}
          </Text>
        </View>

        {/* Input de búsqueda */}
        <View style={styles.inputContainer}>
          <Ionicons 
            name="search" 
            size={20} 
            color={theme.colors.brand.teal} 
            style={styles.searchIcon} 
          />
          <TextInput
            style={styles.input}
            placeholder="Escribí una calle, plaza o lugar..."
            placeholderTextColor={theme.colors.text.muted}
            value={query}
            onChangeText={setQuery}
            autoFocus={true}
            clearButtonMode="while-editing"
            accessible={true}
            accessibilityLabel="Buscar dirección"
            accessibilityHint="Escribe al menos tres letras para buscar calles o puntos de referencia"
          />
          {loading && 
            <ActivityIndicator 
              size="small" 
              color={theme.colors.brand.teal} 
              accessible={true}
              accessibilityLabel="Buscando sugerencias"
            />}
        </View>

        {/* Lista de sugerencias */}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultItem}
              onPress={() => handleSelectPlace(item)}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.fullAddress}`}
              accessibilityHint="Selecciona este lugar como punto del recorrido"
            >
              <View style={styles.iconContainer}>
                <Ionicons 
                  name="location-outline" 
                  size={22} 
                  color={theme.colors.brand.teal} 
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.placeName}>{item.name}</Text>
                <Text style={styles.placeAddress}>{item.fullAddress}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query.length >= 3 && !loading ? (
              <View 
              style={styles.emptyContainer}
                accessible={true}
                accessibilityRole="text"
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.emptyText}>No se encontraron direcciones.</Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (theme: Theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surface.welcome,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  backButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.metrics.font.title.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.surface.card,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.metrics.radius.card,
    borderWidth: 1.5,
    borderColor: theme.colors.brand.teal,
    minHeight: 50,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: theme.metrics.font.body.size,
    color: theme.colors.brand.navy,
    paddingVertical: theme.spacing.xs,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
  },
  resultItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.surface.card,
    padding: theme.spacing.md,
    borderRadius: theme.metrics.radius.card - 4,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  iconContainer: {
    marginRight: theme.spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  placeName: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '700' as const,
    color: theme.colors.brand.navy,
  },
  placeAddress: {
    fontSize: theme.metrics.font.caption.size,
    color: theme.colors.text.muted,
    marginTop: 2,
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center' as const,
  },
  emptyText: {
    fontSize: theme.metrics.font.body.size,
    color: theme.colors.text.muted,
  },
});