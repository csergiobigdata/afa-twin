import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import App from "./App.tsx";

// PWA: recarrega a página sozinha assim que uma versão nova do service
// worker assume o controle. O sw gerado (Workbox, ver vite.config.ts) já
// roda com skipWaiting+clientsClaim - ou seja, a versão nova já ativa
// automaticamente assim que baixada, sem esperar o usuário fechar todas as
// abas. O que faltava era só isto: sem recarregar, a aba já aberta continua
// mostrando o bundle antigo (já carregado em memória) mesmo com o sw novo
// no controle - foi a causa de dois relatos de "a versão não mudou" com a
// versão nova já publicada e confirmada no servidor. O guard `reloaded`
// evita um possível loop de recarregamento.
if ("serviceWorker" in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  // Não espera só a checagem periódica nativa do navegador (pode levar até
  // 24h) - verifica de novo sempre que a aba volta a ficar visível (ex.:
  // usuário trocou de aba e voltou).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
