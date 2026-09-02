import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Si cualquier pantalla revienta con un error inesperado (por ejemplo,
 * un dato que vino incompleto de la base de datos), esto evita que
 * TODA la aplicación se quede en blanco sin explicación. En vez de
 * eso, muestra un aviso y un botón para recargar, y deja un rastro en
 * la consola del navegador (F12) para poder diagnosticarlo.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error atrapado por ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gigante-bg">
          <div className="max-w-sm text-center bg-white border border-gigante-border rounded-xl p-6">
            <p className="text-sm font-semibold text-gigante-navy">Algo salió mal en esta pantalla.</p>
            <p className="text-xs text-gigante-muted mt-2">
              Intenta recargar la página. Si el problema sigue, avísale a Gerencia con una captura de
              esto.
            </p>
            <p className="text-[10px] text-gigante-muted mt-3 break-words">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-gigante-red hover:bg-gigante-redDark text-white text-sm font-semibold rounded-lg px-4 py-2"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
