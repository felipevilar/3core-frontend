import type { GeoPayload } from '~/types'

/**
 * Captura a posição do dispositivo de forma "best-effort" para as ações de
 * campo (a caminho / chegada / finalizar). Nunca lança: se o navegador negar,
 * expirar (8s) ou não suportar, devolve `undefined` e avisa discretamente.
 */
export function useDeviceGeo() {
  const toast = useToast()

  async function capturar(): Promise<GeoPayload | undefined> {
    if (!import.meta.client || !('geolocation' in navigator)) return undefined
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 30_000
        })
      })
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        precisaoM: Math.round(pos.coords.accuracy)
      }
    } catch {
      toast.add({
        title: 'Localização indisponível',
        description: 'A ação será registrada sem coordenadas.',
        icon: 'i-lucide-map-pin-off',
        color: 'neutral'
      })
      return undefined
    }
  }

  return { capturar }
}
