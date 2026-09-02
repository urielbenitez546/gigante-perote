import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  iconColorClass: string; // ej. "bg-gigante-navy" o "bg-gigante-red"
  label: string;
  value: string;
  linkTo?: string;
}

export default function StatCard({ icon: Icon, iconColorClass, label, value, linkTo }: StatCardProps) {
  const content = (
    <div className="bg-white border border-gigante-border rounded-xl p-4 flex flex-col gap-3 h-full">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white ${iconColorClass}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-gigante-muted">{label}</p>
        <p className="text-xl font-bold text-gigante-navy">{value}</p>
      </div>
      {linkTo && (
        <span className="mt-auto flex items-center gap-1 text-xs text-gigante-navy/70">
          Ver detalles <ChevronRight size={14} />
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="block hover:shadow-sm transition-shadow rounded-xl">
        {content}
      </Link>
    );
  }
  return content;
}
