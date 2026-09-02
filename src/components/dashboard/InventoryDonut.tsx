import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface InventoryDonutProps {
  total: number;
  disponibles: number;
  bajoStock: number;
  sinExistencia: number;
}

const COLORS = {
  disponibles: "#0E1E42", // gigante-navy
  bajoStock: "#C41230", // gigante-red
  sinExistencia: "#B9BEC9", // gris neutro
};

export default function InventoryDonut({ total, disponibles, bajoStock, sinExistencia }: InventoryDonutProps) {
  const data = [
    { name: "Disponibles", value: disponibles, color: COLORS.disponibles },
    { name: "Bajo stock", value: bajoStock, color: COLORS.bajoStock },
    { name: "Sin existencia", value: sinExistencia, color: COLORS.sinExistencia },
  ];

  const pct = (n: number) => Math.round((n / total) * 100);

  return (
    <div className="flex items-center gap-4">
      <div className="w-28 h-28 relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-gigante-navy">{total.toLocaleString()}</span>
          <span className="text-[10px] text-gigante-muted">Productos</span>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm">
        <li className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.disponibles }} />
          <span className="text-gigante-navy">Disponibles</span>
          <span className="text-gigante-muted">{disponibles.toLocaleString()} ({pct(disponibles)}%)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.bajoStock }} />
          <span className="text-gigante-navy">Bajo stock</span>
          <span className="text-gigante-muted">{bajoStock.toLocaleString()} ({pct(bajoStock)}%)</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.sinExistencia }} />
          <span className="text-gigante-navy">Sin existencia</span>
          <span className="text-gigante-muted">{sinExistencia.toLocaleString()} ({pct(sinExistencia)}%)</span>
        </li>
      </ul>
    </div>
  );
}
