export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function randomFrom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]!
}

/**
 * Gera e baixa um CSV no navegador.
 *
 * Convenções para abrir "limpo" no Excel em pt-BR sem etapas manuais:
 *  - separador ';' (o Excel pt-BR usa ';' como separador de lista padrão);
 *  - BOM UTF-8 (senão o Excel corrompe acentos);
 *  - cada célula é escapada (aspas/;/quebra de linha) entre aspas duplas.
 *
 * Valores numéricos monetários devem vir já formatados em pt-BR ("1.234,56")
 * para o Excel reconhecê-los como número.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const escape = (v: string | number | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v)
    // Sempre entre aspas: cobre ';', quebras de linha e aspas internas.
    return `"${s.replace(/"/g, '""')}"`
  }
  const lines = [headers, ...rows].map(cols => cols.map(escape).join(';'))
  // BOM UTF-8 (senão o Excel corrompe acentos).
  const content = `\uFEFF${lines.join('\r\n')}`
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Formata "55929819846" → "(55) 92981-9846" e "9232345678" → "(92) 3234-5678". */
export function formatarCelular(raw: string | null | undefined): string {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return raw ?? ''
}
