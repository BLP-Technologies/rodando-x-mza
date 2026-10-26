import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStyles, Theme } from '@/theme';
import { PlaceCategory } from '@/navigation/types';

interface CategoryDropdownProps {
  value: PlaceCategory;
  onSelect: (category: PlaceCategory) => void;
}

const CATEGORIES: PlaceCategory[] = ['CASA', 'TRABAJO', 'ESTUDIO', 'RECREATIVO', 'MEDICO', 'OTRO'];

export const CategoryDropdown = ({ value, onSelect }: CategoryDropdownProps) => {
  const { styles, theme } = useStyles(getStyles);
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>CATEGORÍA</Text>

      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Categoría seleccionada: ${value}. Tocar para cambiar`}
      >
        <Text style={styles.dropdownText}>{value}</Text>
        <Ionicons name="chevron-down" size={20} color={theme.colors.brand.navy} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.menuCard}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.menuItem, value === cat && styles.menuItemActive]}
                onPress={() => {
                  onSelect(cat);
                  setOpen(false);
                }}
              >
                <Text style={[styles.menuItemText, value === cat && styles.menuItemTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const getStyles = (theme: Theme) => ({
  container: {
    marginBottom: theme.spacing.xl,
  },
  label: {
    fontSize: theme.metrics.font.title.size - 2,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase' as const,
  },
  dropdownButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card - 4,
    borderWidth: 1.5,
    borderColor: theme.colors.brand.teal,
    paddingHorizontal: theme.spacing.lg,
    height: 52,
  },
  dropdownText: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '800' as const,
    color: theme.colors.brand.navy,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 34, 45, 0.4)',
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.xl,
  },
  menuCard: {
    backgroundColor: theme.colors.surface.card,
    borderRadius: theme.metrics.radius.card,
    padding: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.brand.teal,
  },
  menuItem: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.metrics.radius.card - 8,
  },
  menuItemActive: {
    backgroundColor: theme.colors.brand.teal ||'#D7EDE7',
  },
  menuItemText: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '700' as const,
    color: theme.colors.brand.navy,
  },
  menuItemTextActive: {
    color: theme.colors.brand.green || '#0E5A4B',
  },
});