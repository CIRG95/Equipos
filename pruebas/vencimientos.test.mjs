import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoFecha, estadoDocumento, habilitacion, diasHasta, textoDias, ultimoDoc, ordenarPendientes } from '../compartido/vencimientos.js';
import { armarZip, crc32, nombreSeguro } from '../compartido/zip.js';

const hoy = '2026-11-13';

test('estado de una fecha con aviso de 30 días', () => {
  assert.equal(diasHasta('2026-11-20', hoy), 7);
  assert.deepEqual(estadoFecha('2026-11-12', { hoy }), { estado: 'vencido', dias: -1 });
  assert.deepEqual(estadoFecha('2026-11-13', { hoy }), { estado: 'por_vencer', dias: 0 });
  assert.deepEqual(estadoFecha('2026-12-13', { hoy }), { estado: 'por_vencer', dias: 30 });
  assert.deepEqual(estadoFecha('2026-12-14', { hoy }), { estado: 'vigente', dias: 31 });
  assert.equal(estadoFecha('', { hoy }).estado, 'falta');
  assert.equal(estadoFecha('', { hoy, vence: false }).estado, 'no_vence');
});

test('documento: plataforma del mandante y obligatoriedad', () => {
  const t = { vence: true, obligatorio: true };
  assert.equal(estadoDocumento(t, null, { hoy }).estado, 'falta');
  assert.equal(estadoDocumento({ vence: true, obligatorio: false }, null, { hoy }).estado, 'opcional');
  assert.equal(estadoDocumento(t, { vence: '2027-07-31' }, { hoy, estadoPlataforma: 'borrador' }).estado, 'pendiente');
  assert.equal(estadoDocumento(t, { vence: '2027-07-31' }, { hoy, estadoPlataforma: 'rechazado' }).estado, 'rechazado');
  assert.equal(estadoDocumento(t, { vence: '2026-03-31' }, { hoy, estadoPlataforma: 'aprobado' }).estado, 'vencido');
  assert.equal(estadoDocumento({ vence: false, obligatorio: true }, { vence: '' }, { hoy, estadoPlataforma: 'aprobado' }).estado, 'no_vence');
});

test('habilitación SUCAL: borrador obligatorio impide, opcional no subido no', () => {
  const req = [
    { id: 'rt', nombre: 'Revisión técnica', vence: true, obligatorio: true },
    { id: 'mant', nombre: 'Certificado de mantención', vence: false, obligatorio: true },
    { id: 'barras', nombre: 'Barras antivuelco', vence: false, obligatorio: false },
  ];
  const docs = [
    { tipoId: 'rt', vence: '2027-07-31', estadoMandante: { codelco: 'aprobado' } },
    { tipoId: 'mant', vence: '', estadoMandante: { codelco: 'borrador' } },
  ];
  const h = habilitacion(req, docs, { hoy, mandanteId: 'codelco' });
  assert.equal(h.habilitado, false);
  assert.deepEqual(h.pendientes.map(f => f.tipo.id), ['mant']);
  docs[1].estadoMandante.codelco = 'aprobado';
  const h2 = habilitacion(req, docs, { hoy, mandanteId: 'codelco' });
  assert.equal(h2.habilitado, true);
  assert.equal(h2.nivel, 'ok');
  assert.equal(h2.filas[2].e.estado, 'opcional');
});

test('documento vigente: el de vencimiento más lejano', () => {
  const d = ultimoDoc([{ tipoId: 'a', vence: '2026-01-01' }, { tipoId: 'a', vence: '2028-01-01' }, { tipoId: 'b', vence: '2030-01-01' }], 'a');
  assert.equal(d.vence, '2028-01-01');
  assert.equal(textoDias({ estado: 'vencido', dias: -3 }), 'vencido hace 3 días');
  assert.equal(textoDias({ estado: 'por_vencer', dias: 1 }), 'vence en 1 día');
  assert.deepEqual(ordenarPendientes([{ nivel: 'ambar', fecha: '2026-11-20' }, { nivel: 'rojo', fecha: '2026-12-01' }, { nivel: 'ambar', fecha: '2026-11-15' }]).map(x => x.fecha), ['2026-12-01', '2026-11-15', '2026-11-20']);
});

test('zip: estructura válida y nombres repetidos numerados', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
  const z = armarZip([{ nombre: 'Ana_Perez/01_Cedula.pdf', datos: new Uint8Array([1, 2, 3]) }, { nombre: 'Ana_Perez/01_Cedula.pdf', datos: new Uint8Array([4]) }]);
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(dv.getUint16(z.length - 22 + 10, true), 2);
  assert.ok(new TextDecoder().decode(z).includes('Ana_Perez/01_Cedula_2.pdf'));
  assert.equal(nombreSeguro('José Muñoz / Título.pdf'), 'Jose_Munoz_Titulo.pdf');
});
