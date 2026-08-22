import type { Person } from "../api/types";

export function uploadedPersonPhotoUrl(filename?: string | null): string | null {
  return filename ? `/media/people/${encodeURIComponent(filename)}` : null;
}

const AVATAR_COLORS = ["#1c4f9c", "#0b7a3f", "#a9662f", "#7a4a9c", "#c62828", "#0e7c86"];

function initialsOf(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/);
  const meaningful = tokens.length >= 2 ? tokens.slice(-2) : tokens;
  return meaningful.map((t) => t[0]?.toUpperCase() ?? "").join("");
}

function colorFor(fullName: string): string {
  let hash = 0;
  for (let i = 0; i < fullName.length; i++) hash = (hash * 31 + fullName.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Foto de perfil da pessoa, com fallback para um avatar de iniciais quando
 * nenhuma foto real foi enviada. */
export default function PersonAvatar({ person, size = 40 }: { person: Pick<Person, "full_name" | "photo_filename">; size?: number }) {
  const url = uploadedPersonPhotoUrl(person.photo_filename);
  if (url) {
    return (
      <img
        src={url} alt={person.full_name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-subtle)", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      title={person.full_name}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: colorFor(person.full_name), color: "#fff", display: "flex",
        alignItems: "center", justifyContent: "center", fontWeight: 700,
        fontSize: size * 0.4, userSelect: "none",
      }}
    >
      {initialsOf(person.full_name)}
    </div>
  );
}
