// Coordenadas aproximadas del centro de Perote, Veracruz.
// Como no contamos con geocodificación real de direcciones DEMO, cada
// reparto se ubica en un punto cercano generado de forma determinista
// a partir de su id (siempre el mismo punto para el mismo reparto),
// solo para fines de visualización en el prototipo.
const PEROTE_CENTER: [number, number] = [19.5610, -97.2400];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function demoCoordsForId(id: string): [number, number] {
  const h = hashString(id);
  const latOffset = ((h % 1000) / 1000 - 0.5) * 0.03;
  const lngOffset = (((h >> 10) % 1000) / 1000 - 0.5) * 0.03;
  return [PEROTE_CENTER[0] + latOffset, PEROTE_CENTER[1] + lngOffset];
}

export { PEROTE_CENTER };
