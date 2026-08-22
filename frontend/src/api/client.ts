const TOKEN_KEY = "afa_twin_token";

// Camada opcional extra de restrição de acesso (ver docs/06-implantacao-nuvem.md).
// Só tem efeito se o backend também tiver AFA_TWIN_ACCESS_KEY configurada;
// sem isso, o cabeçalho é enviado mas ignorado pelo servidor.
const ACCESS_KEY: string | undefined = (import.meta as { env?: Record<string, string> }).env
  ?.VITE_ACCESS_KEY;

function withAccessKey(headers: Record<string, string>): Record<string, string> {
  if (ACCESS_KEY) headers["X-AFA-TWIN-Key"] = ACCESS_KEY;
  return headers;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = withAccessKey({
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  });
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const detail = typeof body === "object" && body?.detail ? body.detail : String(body);
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, detail || "Erro na comunicação com o servidor");
  }
  return body as T;
}

async function upload<T>(path: string, formData: FormData, method: "POST" | "PUT" = "POST"): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = withAccessKey({});
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Content-Type é definido automaticamente pelo navegador (multipart/form-data + boundary).

  const res = await fetch(`/api${path}`, { method, headers, body: formData });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const detail = typeof body === "object" && body?.detail ? body.detail : String(body);
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, detail || "Erro no envio do arquivo");
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => upload<T>(path, formData),
};
