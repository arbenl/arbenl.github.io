function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeAlbanianName(value: string): string {
  return collapseWhitespace(value).normalize("NFC").toLocaleLowerCase("sq-AL");
}

export function normalizeStudentId(value: string): string {
  return value.trim();
}

export function maskDisplayName(value: string): string {
  const parts = collapseWhitespace(value).normalize("NFC").split(" ");

  if (parts.length === 1) {
    return parts[0];
  }

  const surnameInitial = Array.from(parts.at(-1) ?? "")[0];
  return `${parts[0]} ${surnameInitial}.`;
}
