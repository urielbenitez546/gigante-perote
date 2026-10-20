// Aviso sonoro de la campanita (sin archivos: se genera con el navegador).
// Los navegadores solo dejan sonar después de que la persona tocó la página
// alguna vez; si no, simplemente no suena (el aviso en pantalla sí aparece).
const CLAVE = "gigante_sonido_avisos";

export function sonidoActivo(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== "off";
  } catch {
    return true;
  }
}

export function guardarSonidoActivo(activo: boolean) {
  try {
    localStorage.setItem(CLAVE, activo ? "on" : "off");
  } catch {
    /* sin almacenamiento: se queda activo en esta sesión */
  }
}

export function sonarAviso() {
  if (!sonidoActivo()) return;
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const tono = (frecuencia: number, inicio: number, duracion: number) => {
      const osc = ctx.createOscillator();
      const ganancia = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frecuencia;
      ganancia.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
      ganancia.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + inicio + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracion);
      osc.connect(ganancia).connect(ctx.destination);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + duracion + 0.05);
    };
    tono(880, 0, 0.22);
    tono(1175, 0.26, 0.3);
    setTimeout(() => ctx.close().catch(() => undefined), 1200);
  } catch {
    /* sin audio disponible */
  }
}
