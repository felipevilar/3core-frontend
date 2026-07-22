import type { AuthUser } from '~/types'

/**
 * Estado de autenticação (SPA — ssr:false).
 * Token persistido em cookie para sobreviver a reloads; usuário/permissões em useState.
 */
export function useAuth() {
  const { apiBase } = useRuntimeConfig().public
  const token = useCookie<string | null>('auth_token', {
    sameSite: 'lax',
    secure: !import.meta.dev,
    maxAge: 60 * 60 * 8 // 8h, alinhado ao JWT_EXPIRES_IN
  })
  const user = useState<AuthUser | null>('auth_user', () => null)

  const isAuthenticated = computed(() => !!token.value)
  const permissions = computed(() => user.value?.permissions ?? [])

  async function login(email: string, password: string) {
    const res = await $fetch<{ accessToken: string, user: AuthUser }>(`${apiBase}/auth/login`, {
      method: 'POST',
      body: { email, password }
    })
    token.value = res.accessToken
    user.value = res.user
    return res.user
  }

  async function fetchMe() {
    if (!token.value) return null
    try {
      const me = await $fetch<AuthUser>(`${apiBase}/auth/me`, {
        headers: { Authorization: `Bearer ${token.value}` }
      })
      user.value = me
      return me
    } catch {
      // Token inválido/expirado → limpa estado.
      token.value = null
      user.value = null
      return null
    }
  }

  async function updateProfile(bio: string) {
    const updated = await $fetch<AuthUser>(`${apiBase}/auth/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token.value}` },
      body: { bio }
    })
    user.value = updated
    return updated
  }

  async function uploadAvatar(file: File) {
    const { path, signedUrl } = await $fetch<{ path: string, signedUrl: string }>(
      `${apiBase}/auth/me/avatar/upload-url`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.value}` },
        body: { fileName: file.name }
      }
    )

    await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' }
    })

    const updated = await $fetch<AuthUser>(`${apiBase}/auth/me/avatar`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token.value}` },
      body: { storagePath: path }
    })
    user.value = updated
    return updated
  }

  function logout() {
    token.value = null
    user.value = null
    return navigateTo('/login')
  }

  return {
    token,
    user,
    isAuthenticated,
    permissions,
    login,
    fetchMe,
    logout,
    updateProfile,
    uploadAvatar
  }
}
