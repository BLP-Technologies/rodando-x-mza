import React from 'react';
import { View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useStyles, Theme } from '@/theme';

interface PhotoUploaderProps {
  imageUri: string | null;
  onImageChange: (uri: string | null) => void;
}

export const PhotoUploader = ({ imageUri, onImageChange }: PhotoUploaderProps) => {
  const { styles, theme } = useStyles(getStyles);

  const pickImage = async () => {
    try {
      // 1. Pedir permisos de galería
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permiso necesario',
          'Necesitamos acceso a tus imágenes para poder adjuntar la foto del obstáculo.'
        );
        return;
      }

      // 2. Abrir selector de archivos/galería
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onImageChange(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error al abrir la galería:', error);
      Alert.alert('Error', 'No se pudo abrir la galería de imágenes en este momento.');
    }
  };

  const removeImage = () => {
    onImageChange(null);
  };

  if (imageUri) {
    return (
      <View style={styles.previewContainer}>
        <Image
          source={{ uri: imageUri }}
          style={styles.previewImage}
          resizeMode="cover"
          accessible={true}
          accessibilityRole="image"
          accessibilityLabel="Fotografía adjunta de la barrera u obstáculo"
        />
        <TouchableOpacity
          style={styles.removeButton}
          onPress={removeImage}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Eliminar foto seleccionada"
          accessibilityHint="Elimina la imagen actual y permite volver a elegir otra de la galería"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={20} color={theme.colors.text.inverse} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.photoUploadBox}
      onPress={pickImage}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Agregar foto del obstáculo"
      accessibilityHint="Abre la galería del dispositivo para seleccionar una imagen"
    >
      <Ionicons name="images-outline" size={22} color={theme.colors.brand.teal} />
      <Text style={styles.photoUploadText}>Agregar foto</Text>
    </TouchableOpacity>
  );
};

const getStyles = (theme: Theme) => ({
  photoUploadBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderStyle: 'dashed' as const,
    borderRadius: theme.metrics.radius.card,
    backgroundColor: theme.colors.surface.card,
    paddingVertical: theme.spacing.lg,
    minHeight: 56,
    marginBottom: theme.spacing.xl,
  },
  photoUploadText: {
    fontSize: theme.metrics.font.body.size,
    fontWeight: '600' as const,
    color: theme.colors.brand.navy,
  },
  previewContainer: {
    position: 'relative' as const,
    borderRadius: theme.metrics.radius.card,
    overflow: 'hidden' as const,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    marginBottom: theme.spacing.xl,
    height: 180,
    backgroundColor: theme.colors.surface.card,
  },
  previewImage: {
    width: '100%' as const,
    height: '100%' as const,
  },
  removeButton: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: theme.metrics.radius.pill,
    backgroundColor: theme.colors.state.danger,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});