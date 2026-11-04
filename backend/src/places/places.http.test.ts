import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const app = createApp();

describe('POST /api/places - Validación de esquemas HTTP', () => {
  it('rechaza un pedido vacío con código de validación', async () => {
    const res = await request(app).post('/api/places').send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect((res.body as any).error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza un lugar sin nombre requerido', async () => {
    const res = await request(app)
      .post('/api/places')
      .send({
        address: 'San Martín 123',
        latitude: -32.88945,
        longitude: -68.84583,
        category: 'OTRO',
      });

    expect(res.status).toBe(400);
    expect((res.body as any).error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza coordenadas inválidas o fuera de rango', async () => {
    const res = await request(app)
      .post('/api/places')
      .send({
        name: 'Lugar Inválido',
        address: 'San Martín 123',
        latitude: 195, // Latitud fuera de [-90, 90]
        longitude: -68.84583,
      });

    expect(res.status).toBe(400);
    expect((res.body as any).error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza tipos de datos no numéricos para las coordenadas', async () => {
    const res = await request(app)
      .post('/api/places')
      .send({
        name: 'Plaza',
        address: 'Chile y Espejo',
        latitude: 'invalido',
        longitude: -68.84583,
      });

    expect(res.status).toBe(400);
    expect((res.body as any).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/places/:id - Validación de esquemas HTTP', () => {
  it('rechaza un ID de parámetro no numérico o inválido', async () => {
    const res = await request(app)
      .patch('/api/places/abc')
      .send({
        name: 'Nombre Actualizado',
      });

    expect(res.status).toBe(400);
    expect((res.body as any).error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza una actualización con coordenadas fuera de rango', async () => {
    const res = await request(app)
      .patch('/api/places/1')
      .send({
        latitude: 95,
      });

    expect(res.status).toBe(400);
    expect((res.body as any).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/places/:id - Validación de esquemas HTTP', () => {
  it('rechaza un ID de parámetro inválido en la eliminación', async () => {
    const res = await request(app).delete('/api/places/no-es-un-id');

    expect(res.status).toBe(400);
    expect((res.body as any).error.code).toBe('VALIDATION_ERROR');
  });
});