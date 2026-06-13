// Permite `definePageMeta({ permission: 'clientes.ver' })` com tipagem.
declare module '#app' {
  interface PageMeta {
    permission?: string
  }
}

export {}
