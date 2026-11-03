'use client';

/**
 * El estado de datos del portal: una sola caché de queries para todo el grupo de
 * rutas `(portal)`.
 *
 * Va en `(portal)` y no en el layout raíz porque `(auth)` no hace queries: montar
 * un `QueryClient` ahí solo para las tres vistas de login sería estado sin uso.
 *
 * El cliente se crea una vez por navegador (`useState` con inicializador
 * perezoso): si se creara en cada render, cada uno tendría su propia caché y las
 * queries se pedirían de nuevo en cada re-render.
 */

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cada paneo pide un bbox distinto, así que cada uno deja su entrada en
        // la caché con su colección de 30–230 KB. El default de 5 minutos
        // acumularía decenas durante una sesión de paneo; un minuto alcanza para
        // volver a la vista anterior de inmediato sin crecer sin control.
        gcTime: 60_000,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}