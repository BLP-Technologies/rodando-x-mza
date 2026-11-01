import { z } from 'zod';

export const TutorialSchema = z.object({
  id: z.union([z.number(), z.string()]),
  category_id: z.number().optional(),
  category: z.string().default('General'),
  title: z.string().min(3, 'El título es requerido'),
  description: z.string().max(300, 'La descripción no puede superar 300 caracteres'),
  video_url: z.string().optional(),
  youtubeId: z.string().min(1, 'El identificador de YouTube es requerido'),
  duration: z.string().default(''),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable().optional(),
});

export type Tutorial = z.infer<typeof TutorialSchema>;
export type TutorialFilterCategory = 'TODOS' | string;