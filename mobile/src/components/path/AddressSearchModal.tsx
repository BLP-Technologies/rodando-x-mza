import React, { useState, useEffect } from 'react';
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

  // Para esperar 350ms antes de consultar la API
  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      const suggestions = await searchAddressSuggestions(query);
      setResults(suggestions);
      setLoading(false);
    }, 350);

    return () => clearTimeout(handler);
  }, [query]);

  const handleSelectPlace = (place: PlaceSuggestion) => {
    onSelect(place);
    setQuery('');
    setResults([]);
    onClose();
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Cabecera del buscador */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.brand.navy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>

        {/* Input de búsqueda */}
        <View style={styles.inputContainer}>
          <Ionicons name="search" size={20} color={theme.colors.brand.teal} style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Escribí una calle, plaza o lugar..."
            placeholderTextColor={theme.colors.text.muted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            clearButtonMode="while-editing"
          />
          {loading && <ActivityIndicator size="small" color={theme.colors.brand.teal} />}
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
            >
              <View style={styles.iconContainer}>
                <Ionicons name="location-outline" size={22} color={theme.colors.brand.teal} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.placeName}>{item.name}</Text>
                <Text style={styles.placeAddress}>{item.fullAddress}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query.length >= 3 && !loading ? (
              <View style={styles.emptyContainer}>
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