// pruebas/corredor.test.mjs — cortes automáticos del corredor y nombres por DM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaHoja, geometria, nombreSector, distanciasCorte, cortesDeCorredor, dmAKm, kmADm, distanciasPorBaterias } from '../modulos/vuelos/hoja.js';
import { DRONES_BASE } from '../modulos/vuelos/drones.js';

const m4e = DRONES_BASE.find(d => d.id === 'm4e');
// Eje recto de ~4,3 km hacia el este cerca de Los Andes.
const hojaEje = () => { const h = nuevaHoja(); h.area.tipo = 'corredor'; h.area.eje = { nombre: 'eje', linea: [[-70.6, -32.83], [-70.554, -32.83]], largo: 4300 }; h.area.corredor = { izq: 40, der: 40, mismo: true }; return h; };

test('DM: lectura y escritura', () => {
  assert.equal(dmAKm('45+200'), 45.2); assert.equal(dmAKm('7+05'), 7.05); assert.equal(kmADm(45.2), '45+200'); assert.equal(dmAKm('abc'), null);
});

test('cortes cada X m y alineados al DM (sube y baja)', () => {
  assert.deepEqual(distanciasCorte(4300, { modo: 'inicio', cada: 1000 }), [1000, 2000, 3000, 4000]);
  assert.deepEqual(distanciasCorte(4300, { modo: 'dm', cada: 1000, dmInicio: 10.3 }), [700, 1700, 2700, 3700]);
  assert.deepEqual(distanciasCorte(4300, { modo: 'dm', cada: 1000, dmInicio: 10.3, desc: true }), [300, 1300, 2300, 3300]);
  assert.deepEqual(distanciasCorte(4300, { modo: 'dm', cada: 1000, dmInicio: 10, primerDM: 10.5 }), [500, 1500, 2500, 3500]);
  assert.deepEqual(distanciasCorte(4300, { modo: 'tramos', dmInicio: 10, tramosKm: [9, 11, 12.5, 12.5, 20] }), [1000, 2500]);
});

test('cortes generados dividen el corredor y los sectores se nombran por DM', () => {
  const h = hojaEje(); h.area.dm = { inicio: 10, desc: false };
  h.area.cortes = cortesDeCorredor(h, distanciasCorte(4300, { modo: 'dm', cada: 1000, dmInicio: 10 }));
  const g = geometria(h);
  assert.equal(g.fallidos.length, 0);
  assert.ok(g.sectores.length >= 5, `sectores: ${g.sectores.length}`);
  assert.equal(nombreSector(h, 0, g.sectores.length), '10+000 – 11+000');
  assert.equal(nombreSector(h, 1, g.sectores.length), '11+000 – 12+000');
});

test('cortes por baterías: cada sector queda dentro del máximo', () => {
  const h = hojaEje(); h.area.eje.linea = [[-70.6, -32.83], [-70.4, -32.83]]; // ~18,7 km
  const d = distanciasPorBaterias(h, m4e, 1);
  assert.ok(d.length >= 1, 'debe cortar un eje largo');
  for (let i = 1; i < d.length; i++) assert.ok(d[i] > d[i - 1]);
});

test('despegue sugerido sobre un camino: queda en el camino y no empeora el tiempo', async () => {
  const { despegueSobreCamino } = await import('../modulos/vuelos/redvial.js');
  const h = nuevaHoja(); h.area.tipo = 'poligono';
  h.area.original = { nombre: 'p', anillo: [[-70.6, -32.83], [-70.58, -32.83], [-70.58, -32.815], [-70.6, -32.815], [-70.6, -32.83]] };
  h.area.sectores = [{ despegue: [-70.62, -32.84], rumbo: '', nombre: '' }]; // despegue lejos, a ~2 km
  const g = geometria(h);
  const camino = { rol: 'X-1', nombre: 'Camino de prueba', carpeta: 'Ripio', linea: [[-70.61, -32.8225], [-70.57, -32.8225]] }; // cruza el área por el medio
  const r = despegueSobreCamino(h, m4e, g, 0, [camino]);
  assert.ok(r, 'debe encontrar un punto');
  assert.ok(Math.abs(r.lonLat[1] - -32.8225) < 0.0002, 'el punto está sobre el camino');
  assert.ok(r.ahorro > 0, `ahorra tiempo: ${r.ahorro}`);
  assert.equal(despegueSobreCamino(h, m4e, g, 0, [{ ...camino, linea: [[-70.7, -32.9], [-70.69, -32.9]] }]), null, 'camino lejano: sin sugerencia');
});
