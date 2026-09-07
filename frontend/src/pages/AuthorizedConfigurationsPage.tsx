import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { AuthorizedConfiguration, AuthorizedConfigPdfLoadResult, ConfigurationCode } from "../api/types";
import AuthorizedConfigSymbol from "../components/AuthorizedConfigSymbol";
import ConfigurationDiagram from "../components/ConfigurationDiagram";

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

  // Códigos de Configuração (ex.: "12", "21I") - catálogo consultável de
  // combinações padronizadas de equipamento por estação (ver
  // ConfigurationDiagram e AvailabilityPage → Lançamento manual, onde um
  // código pode ser lançado de uma vez).
  const [codes, setCodes] = useState<ConfigurationCode[]>([]);
  useEffect(() => {
    api.get<ConfigurationCode[]>("/configuration-codes").then(setCodes).catch(() => setCodes([]));
  }, []);
  const [previewCodeId, setPreviewCodeId] = useState<number | "">("");
  const previewCode = codes.find((c) => c.id === previewCodeId) ?? null;
  const [codeStatusFilter, setCodeStatusFilter] = useState<"" | "A" | "I">("");
  function symbolFor(equipment: string): string | undefined {
    return items.find((i) => i.equipment === equipment)?.symbol_svg;
  }

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

      <div className="card" style={{ padding: 18, marginTop: 18 }}>
        <h2 style={{ fontSize: 15.5, margin: "0 0 4px" }}>Códigos de Configuração</h2>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 4, maxWidth: 640 }}>
          Combinações padronizadas de equipamento por estação (5 a 1), como o esquadrão já nomeia com um
          código curto (ex.: "12", "21I"). Todos os {codes.length} códigos do manual de referência estão
          cadastrados aqui para consulta; só os <strong>Ativos</strong> ({codes.filter((c) => c.status_disp === "A").length}
          , marcados com bolinha vermelha no boletim vigente) aparecem como opção para lançar no
          lançamento manual de disponibilidade.
        </p>
        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 14, maxWidth: 640 }}>
          Os códigos <strong>Inativos</strong> têm o código em si conferido, mas não o detalhamento por
          estação (não veio de linhas individuais como os Ativos) - por isso aparecem sem símbolo/estação
          preenchida abaixo.
        </p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 220px", maxWidth: 260 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {(["", "A", "I"] as const).map((f) => (
                <button
                  key={f} type="button" className={`btn btn-sm ${codeStatusFilter === f ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setCodeStatusFilter(f)}
                >
                  {f === "" ? "Todos" : f === "A" ? "Ativos" : "Inativos"}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Selecione um código
            </label>
            <select
              value={previewCodeId} onChange={(e) => setPreviewCodeId(e.target.value ? Number(e.target.value) : "")}
              style={{ width: "100%" }}
            >
              <option value="">— Selecione —</option>
              {codes.filter((c) => !codeStatusFilter || c.status_disp === codeStatusFilter).map((c) => (
                <option key={c.id} value={c.id}>{c.code} ({c.status_disp === "A" ? "Ativo" : "Inativo"})</option>
              ))}
            </select>
          </div>
          <div>
            <ConfigurationDiagram code={previewCode} symbolFor={symbolFor} />
            {previewCode && previewCode.status_disp === "I" && (
              <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8, maxWidth: 260, textAlign: "center" }}>
                Código Inativo: não disponível para lançar; detalhamento por estação não conferido.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
