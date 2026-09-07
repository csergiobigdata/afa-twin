import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { AuthorizedConfiguration, AuthorizedConfigPdfLoadResult } from "../api/types";
import AuthorizedConfigSymbol from "../components/AuthorizedConfigSymbol";

/** Ícone de documento PDF (troca o emoji de câmera anterior, de quando a
 * carga era feita por imagem) - marcação estática do próprio app, não dado
 * de usuário, então não passa pelo sanitizador de AuthorizedConfigSymbol. */
function PdfFileIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ verticalAlign: -3 }}>
      <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="#fff" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M15 2v5h5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="4" y="13" width="13" height="7" rx="1.2" fill="#d64545" />
      <text x="10.5" y="18.3" fontSize="6.2" fontWeight="700" fontFamily="Arial, sans-serif" fill="#fff" textAnchor="middle">PDF</text>
    </svg>
  );
}

/** Cadastro de Configurações Autorizadas para Aeronaves: equipamentos/cargas
 * de asas e hardpoints (pilones vazios, armamento, lançadores, tanques
 * externos, pods etc.) que podem aparecer como opção de "Configuração" no
 * lançamento de disponibilidade (ver AvailabilityPage) quando status_disp =
 * "A" (Ativo). O cadastro não tem criação manual pela interface - os itens
 * já vêm de fábrica (seed) e o status_disp é atualizado em lote carregando
 * um PDF de Configurações Autorizadas (ex.: uma Ordem Técnica/OTFN da
 * aeronave) - ver "Carregar configurações autorizadas" abaixo e
 * backend/app/config_pdf.py. */
export default function AuthorizedConfigurationsPage() {
  const [items, setItems] = useState<AuthorizedConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AuthorizedConfigPdfLoadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reload() {
    api.get<AuthorizedConfiguration[]>("/authorized-configurations")
      .then(setItems).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function toggleStatus(item: AuthorizedConfiguration) {
    await api.put(`/authorized-configurations/${item.id}`, {
      status_disp: item.status_disp === "A" ? "I" : "A",
    });
    reload();
  }

  async function remove(item: AuthorizedConfiguration) {
    if (!confirm(`Remover "${item.equipment}" deste cadastro?`)) return;
    await api.del(`/authorized-configurations/${item.id}`);
    reload();
  }

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.upload<AuthorizedConfigPdfLoadResult>("/authorized-configurations/load-from-pdf", fd);
      setResult(res);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar o documento.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) return <p>Carregando…</p>;

  const activeCount = items.filter((i) => i.status_disp === "A").length;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Configurações Autorizadas para Aeronaves</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 6, maxWidth: 720 }}>
        Equipamentos e cargas de asas/hardpoints (pilones, armamento, lançadores, tanques externos, pods
        etc.) que podem aparecer como opção de "Configuração" no lançamento de disponibilidade. Somente os
        itens com status <strong>Ativo</strong> aparecem como opção selecionável.
      </p>
      <p style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 18 }}>
        Símbolos ilustrativos, adaptados da tabela de referência do esquadrão — não é um fac-símile
        pixel a pixel do documento original. {activeCount} de {items.length} configuração(ões) ativa(s).
      </p>

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ fontSize: 15.5, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <PdfFileIcon /> Carregar configurações autorizadas
          </h2>
          <div>
            <input
              ref={fileInputRef} type="file" accept="application/pdf,.pdf" hidden
              onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
            />
            <button
              type="button" className="btn btn-primary btn-sm"
              disabled={uploading} onClick={() => fileInputRef.current?.click()}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <PdfFileIcon size={15} /> {uploading ? "Processando…" : "Carregar configurações autorizadas"}
            </button>
          </div>
        </div>
        {result && (
          <div className="card" style={{ marginTop: 14, padding: 12, background: "var(--bg-surface-alt)" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {result.items_checked} item(ns) verificado(s) — {result.active_count} ativo(s), {result.inactive_count} inativo(s).
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{result.note}</div>
          </div>
        )}
        {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5, marginTop: 12 }}>{error}</p>}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="scroll-x">
          <table>
            <thead>
              <tr><th>Símbolo</th><th>Equipamento</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><AuthorizedConfigSymbol svg={item.symbol_svg} /></td>
                  <td style={{ fontSize: 13, opacity: item.status_disp === "A" ? 1 : 0.55 }}>{item.equipment}</td>
                  <td>
                    <span
                      className={`badge ${item.status_disp === "A" ? "badge-ok" : "badge-neutral"}`}
                      style={{ cursor: "pointer" }}
                      title="Alternar Ativo/Inativo"
                      onClick={() => toggleStatus(item)}
                    >
                      {item.status_disp === "A" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => remove(item)}>Remover</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={4} style={{ color: "var(--text-secondary)" }}>Nenhuma configuração cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
