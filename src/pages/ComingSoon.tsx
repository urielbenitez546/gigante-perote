interface ComingSoonProps {
  title: string;
  stage: string;
}

export default function ComingSoon({ title, stage }: ComingSoonProps) {
  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-gigante-navy">{title}</h1>
      <div className="mt-6 bg-white border border-gigante-border rounded-xl p-5">
        <p className="text-sm text-gigante-navy">
          Este módulo todavía no está construido — se desarrollará en la{" "}
          <strong>{stage}</strong>, siguiendo el plan de etapas acordado.
        </p>
      </div>
    </div>
  );
}
