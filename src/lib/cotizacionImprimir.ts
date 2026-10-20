import type { Cotizacion } from "../hooks/useCotizaciones";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dia = (ymd: string) =>
  new Date(ymd + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

/** Abre la cotización lista para imprimir o guardar como PDF (desde el diálogo de impresión). */
export function imprimirCotizacion(c: Cotizacion) {
  const filas = c.cotizacion_items
    .map(
      (i) => `<tr>
        <td>${esc(i.product?.code ?? "")}</td>
        <td>${esc(i.product?.name ?? "")}${i.tipo_precio === "promocion" ? ' <span class="promo">Promoción</span>' : ""}</td>
        <td class="r">${i.quantity.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${esc(i.product?.unit ?? "")}</td>
        <td class="r">${money(Number(i.unit_price))}</td>
        <td class="r">${money(Number(i.unit_price) * Number(i.quantity))}</td>
      </tr>`
    )
    .join("");

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return false;
  win.document.write(`
    <html><head><title>Cotización ${esc(c.folio)}</title>
    <style>
      @page { size: letter; margin: 14mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 13px; }
      h1 { font-size: 20px; margin: 0; }
      .sub { color: #555; margin: 2px 0 14px; }
      .cab { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; }
      .folio { text-align: right; }
      .folio b { font-size: 18px; }
      .cliente { margin: 12px 0; line-height: 1.5; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { text-align: left; background: #eee; border: 1px solid #999; padding: 6px; font-size: 12px; }
      td { border: 1px solid #bbb; padding: 6px; vertical-align: top; }
      .r { text-align: right; white-space: nowrap; }
      .promo { font-size: 10px; color: #b91c1c; font-weight: bold; }
      .total { text-align: right; font-size: 17px; font-weight: bold; margin-top: 10px; }
      .notas { margin-top: 12px; padding: 8px; border: 1px dashed #999; }
      .pie { margin-top: 18px; font-size: 11px; color: #555; }
    </style></head><body>
      <div class="cab">
        <div>
          <h1>El Gigante de los Azulejos y Mármoles</h1>
          <div class="sub">Sucursal Perote · Cotización</div>
        </div>
        <div class="folio">
          <b>${esc(c.folio)}</b><br/>
          Fecha: ${dia(c.created_at.slice(0, 10))}<br/>
          Vigencia: hasta el ${dia(c.vigencia_hasta)}
        </div>
      </div>
      <div class="cliente">
        <b>Cliente:</b> ${esc(c.customer_name)}<br/>
        ${c.customer_phone ? `<b>Teléfono:</b> ${esc(c.customer_phone)}<br/>` : ""}
        ${c.customer_address ? `<b>Dirección:</b> ${esc(c.customer_address)}` : ""}
      </div>
      <table>
        <thead><tr><th>Código</th><th>Descripción</th><th class="r">Cantidad</th><th class="r">Precio</th><th class="r">Importe</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="total">Total: ${money(Number(c.total))}</div>
      ${c.notas ? `<div class="notas"><b>Notas:</b> ${esc(c.notas)}</div>` : ""}
      <div class="pie">Los precios y la existencia pueden cambiar sin previo aviso. Esta cotización no aparta el material.</div>
      <script>window.onload = () => window.print();</script>
    </body></html>
  `);
  win.document.close();
  return true;
}
