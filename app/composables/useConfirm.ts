type ConfirmColor = 'error' | 'primary' | 'warning' | 'success' | 'info' | 'neutral'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Cor do botão de confirmação (ex.: 'error' para deleções). */
  confirmColor?: ConfirmColor
  icon?: string
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
}

/**
 * Diálogo de confirmação reutilizável e baseado em Promise.
 *
 * Uso: `if (await confirm({ title, message, confirmColor: 'error' })) { ... }`
 * Requer <ConfirmDialog /> montado uma vez (no layout).
 */
export function useConfirm() {
  const state = useState<ConfirmState>('confirm-dialog', () => ({
    open: false,
    title: ''
  }))
  // Resolver da Promise atual — mantido fora do estado serializável.
  const resolver = useState<((v: boolean) => void) | null>(
    'confirm-dialog-resolver',
    () => null
  )

  function confirm(options: ConfirmOptions): Promise<boolean> {
    state.value = { ...options, open: true }
    return new Promise<boolean>((resolve) => {
      resolver.value = resolve
    })
  }

  function _settle(result: boolean) {
    state.value = { ...state.value, open: false }
    resolver.value?.(result)
    resolver.value = null
  }

  return { state, confirm, _settle }
}
