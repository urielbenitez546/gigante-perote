import { createClient } from "@supabase/supabase-js";

// IMPORTANTE: estas dos variables son PÚBLICAS por diseño en apps de Supabase.
// La seguridad real se aplica del lado del servidor mediante políticas RLS,
// nunca aquí. NUNCA coloques aquí la "service_role key".
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Faltan variables de entorno VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Revisa tu archivo .env (copia .env.example) y reinicia el servidor de desarrollo."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
