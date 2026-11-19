// modulos/vuelos/avance-datos.js — v0.18a: registrar el avance de un sector (lo usan el Sistema y la app de Terreno).
// Un registro al 100 % marca la columna Terreno del Seguimiento si el proyecto tiene un tramo con el mismo nombre
// que el sector, y la hoja pasa sola a «Volado» cuando todos sus sectores quedan al 100 %.

import { registrarAvance, avanceDeHoja, obtenerPlan, guardarPlan } from './datos.js';
import { estadoSectores, totalesAvance, problemaRegistro } from './avance.js';
import * as Seguimiento from '../seguimiento/seguimiento.js';

const norm = t => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Guarda el registro y devuelve { registro, totales, terminado, tramo } (tramo: nombre del tramo marcado, o null). */
export async function registrarAvanceSector(r, { personaId = null, nombrePersona = '', origen = 'sistema' } = {}) {
  const problema = problemaRegistro(r);
  if (problema) throw new Error(problema);
  const hoja = await obtenerPlan(r.hojaId);
  if (!hoja) throw new Error('Esa hoja de vuelo no está en este equipo. Sincroniza con la nube del Sistema.');
  const registro = await registrarAvance({ ...r, proyectoId: hoja.proyectoId || null }, { personaId, origen });
  const sectores = (hoja.resumen && hoja.resumen.listaSectores) || [];
  const t = totalesAvance(estadoSectores(sectores, await avanceDeHoja(hoja.id)));
  if (t.terminado && hoja.estado !== 'volada') await guardarPlan({ ...hoja, estado: 'volada' });
  let tramo = null;
  if (Number(r.pct) >= 100 && hoja.proyectoId) {
    try {
      const seg = await Seguimiento.tramosDeProyecto(hoja.proyectoId);
      const t2 = seg && seg.areas.flatMap(a => a.tramos).find(x => norm(x.nombre) === norm(r.sector) || norm(x.n) === norm(r.sector));
      if (t2 && !t2.volado) { await Seguimiento.marcarTramoVolado(hoja.proyectoId, t2.id, { fecha: r.fecha, por: nombrePersona, nota: `Sector ${r.sector} volado (avance)` }); tramo = t2.nombre; }
    } catch { /* sin seguimiento: no se marca nada */ }
  }
  return { registro, totales: t, terminado: t.terminado, tramo };
}
