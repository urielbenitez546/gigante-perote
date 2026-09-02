import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import Header from "./Header";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gigante-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
        <footer className="hidden md:block text-center text-xs text-gigante-muted py-4 border-t border-gigante-border">
          EL GIGANTE DE LOS AZULEJOS Y MÁRMOLES | Sucursal Perote
          <br />© {new Date().getFullYear()} Todos los derechos reservados.
        </footer>
      </div>
      <BottomNav />
    </div>
  );
}
