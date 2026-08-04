import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// Registro del Service Worker para soporte de notificaciones PWA (Chrome/Safari)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Oinkash Service Worker registrado:', reg.scope))
      .catch(err => console.error('Error al registrar SW:', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);