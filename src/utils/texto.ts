/** Normaliza texto para comparar en buscadores: ignora acentos y mayúsculas/minúsculas. */
export function normalizarTexto(s: string | null | undefined) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}
