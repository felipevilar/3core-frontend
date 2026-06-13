import type { $Fetch } from 'nitropack'

/**
 * - Cria `$api`: instância de $fetch com baseURL da API, que anexa o Bearer token
 *   e, em 401, faz logout + redireciona para /login.
 * - Hidrata o usuário no boot da app se houver token no cookie.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  const { apiBase } = useRuntimeConfig().public
  const { token, user, logout, fetchMe } = useAuth()

  const api = $fetch.create({
    baseURL: apiBase as string,
    onRequest({ options }) {
      if (token.value) {
        options.headers = new Headers(options.headers)
        options.headers.set('Authorization', `Bearer ${token.value}`)
      }
    },
    onResponseError({ response }) {
      if (response.status === 401 && token.value) {
        logout()
      }
    }
  })

  // Hidrata o usuário a partir do token persistido (SPA).
  if (token.value && !user.value) {
    await fetchMe()
  }

  nuxtApp.provide('api', api as $Fetch)
})

declare module '#app' {
  interface NuxtApp {
    $api: $Fetch
  }
}
declare module 'vue' {
  interface ComponentCustomProperties {
    $api: $Fetch
  }
}
