import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { demoCoordsForId, PEROTE_CENTER } from "../../lib/demoGeo";
import type { Delivery } from "../../types";
import { DELIVERY_STATUS_LABELS } from "../../types";

// Fix del ícono default de Leaflet con bundlers como Vite.
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Props {
  deliveries: Delivery[];
}

export default function RepartosMap({ deliveries }: Props) {
  return (
    <div className="rounded-xl overflow-hidden border border-gigante-border h-72">
      <MapContainer center={PEROTE_CENTER} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {deliveries.map((d) => {
          const pos = demoCoordsForId(d.id);
          return (
            <Marker key={d.id} position={pos} icon={icon}>
              <Popup>
                <strong>{d.sale.customer_name}</strong>
                <br />
                {d.sale.customer_address}
                <br />
                Estado: {DELIVERY_STATUS_LABELS[d.status]}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
