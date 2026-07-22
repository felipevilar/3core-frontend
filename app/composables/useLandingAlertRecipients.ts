export interface AlertRecipient {
  id: number
  name: string
  email: string
  role: string
}

export function useLandingAlertRecipients() {
  const { $api } = useNuxtApp()

  const { data: recipients, refresh, status } = useFetch<AlertRecipient[]>(
    '/landing-config/alert-recipients',
    { $fetch: $api as typeof $fetch }
  )

  async function setRecipients(userIds: number[]) {
    await $api('/landing-config/alert-recipients', {
      method: 'PUT',
      body: { userIds }
    })
    await refresh()
  }

  return { recipients, status, setRecipients, refresh }
}
