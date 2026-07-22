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
