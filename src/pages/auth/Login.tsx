import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, Headphones, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const { session, signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) setFormError(error);
  }

  return (
    <div className="min-h-screen flex bg-gigante-bg">
      {/* Panel lateral azul - solo escritorio */}
      <div className="hidden md:flex md:w-1/2 lg:w-2/5 bg-gigante-navy text-white flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-gigante-red/20" />
        <div />
        <div className="relative z-10 flex flex-col items-center text-center gap-4">
          <div className="w-28 h-28 rounded-full border-2 border-white/30 flex items-center justify-center bg-white/5">
            <span className="text-4xl font-bold text-gigante-red">G</span>
          </div>
          <div>
            <p className="text-2xl font-extrabold tracking-wide">EL GIGANTE</p>
            <p className="text-xs tracking-[0.2em] text-white/70">DE LOS AZULEJOS Y MÁRMOLES</p>
          </div>
          <div className="w-10 h-0.5 bg-gigante-red my-1" />
          <p className="text-lg font-semibold">Portal interno</p>
          <p className="text-white/80">Sucursal Perote</p>
        </div>
        <div className="relative z-10 flex flex-col items-center text-center gap-3 text-white/80">
          <Users size={28} />
          <p className="max-w-xs text-sm">
            Herramientas e información para hacer nuestro trabajo más fácil y organizado.
          </p>
        </div>
        <p className="relative z-10 text-center text-xs text-white/60">
          El Gigante de los Azulejos y Mármoles | Sucursal Perote
          <br />© 2026 Todos los derechos reservados.
        </p>
      </div>

      {/* Formulario */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Encabezado solo móvil */}
        <div className="md:hidden flex flex-col items-center text-center gap-2 mb-6">
          <div className="w-20 h-20 rounded-full border-2 border-gigante-navy/20 flex items-center justify-center">
            <span className="text-3xl font-bold text-gigante-red">G</span>
          </div>
          <p className="text-xl font-extrabold text-gigante-navy tracking-wide">EL GIGANTE</p>
          <p className="text-[10px] tracking-[0.2em] text-gigante-muted">DE LOS AZULEJOS Y MÁRMOLES</p>
        </div>

        <div className="w-full max-w-sm bg-gigante-card rounded-2xl shadow-sm border border-gigante-border p-6 md:p-8">
          <h1 className="text-xl font-bold text-gigante-navy text-center">Bienvenido</h1>
          <p className="text-sm text-gigante-muted text-center mt-1 mb-6">Inicia sesión para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gigante-navy mb-1">
                Usuario
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ingresa tu usuario"
                className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gigante-navy mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="w-full rounded-lg border border-gigante-border px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-gigante-navy/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gigante-muted"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gigante-navy/80">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-gigante-border"
                />
                Recordarme
              </label>
              <button type="button" className="text-gigante-red hover:underline">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {formError && (
              <p className="text-sm text-gigante-red bg-gigante-red/10 rounded-lg px-3 py-2">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-gigante-red hover:bg-gigante-redDark disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              <LogIn size={18} />
              {submitting ? "Ingresando..." : "INGRESAR"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-gigante-border" />
            <span className="text-xs text-gigante-muted">o</span>
            <div className="h-px flex-1 bg-gigante-border" />
          </div>

          <div className="flex flex-col items-center gap-1 text-sm text-gigante-navy/80">
            <div className="flex items-center gap-2">
              <Headphones size={16} />
              <span className="font-medium">¿Necesitas ayuda?</span>
            </div>
            <p className="text-xs text-gigante-muted text-center">Comunícate con tu jefe o gerente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
