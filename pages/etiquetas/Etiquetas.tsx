// Esta pantalla es un iframe hacia /etiquetas.html (carpeta "public"),
// que es la herramienta de etiquetas construida y probada aparte.
// Se integra así, en vez de reescribirla en React, para no arriesgar
// nada de su comportamiento ya validado (lista de productos, campos
// opcionales, orientación, posición de inicio en la hoja, letreros de
// descuento en forma de estrella, etc.). Si más adelante se quiere que
// comparta datos con el resto del sitio (por ejemplo, precargar un
// producto desde Inventario), ese es el momento de convertirla en un
// componente React de verdad.
export default function Etiquetas() {
  return (
    <div style={{ height: "calc(100vh - 32px)", minHeight: 600 }}>
      <iframe
        src="/etiquetas.html"
        title="Generador de Etiquetas"
        style={{ width: "100%", height: "100%", border: "none", borderRadius: 12 }}
      />
    </div>
  );
}
