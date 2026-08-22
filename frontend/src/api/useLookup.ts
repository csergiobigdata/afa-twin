import { useEffect, useState } from "react";
import { api } from "./client";
import type { LookupCategory, LookupItem } from "./types";

/** Valores ativos de um cadastro auxiliar (ex.: Especialidade, Esquadrão),
 * usados para popular listboxes/selects nos formulários. */
export function useLookupValues(category: LookupCategory): string[] {
  const [values, setValues] = useState<string[]>([]);
  useEffect(() => {
    api.get<LookupItem[]>(`/lookups?category=${encodeURIComponent(category)}`)
      .then((items) => setValues(items.map((i) => i.value)))
      .catch(() => setValues([]));
  }, [category]);
  return values;
}
