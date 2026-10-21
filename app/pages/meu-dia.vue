<script setup lang="ts">
import { format, parseISO, addDays, subDays, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Motivo, RotaItem } from '~/types'

definePageMeta({ permission: 'atendimentos.ver_solicitacoes' })

const { $api } = useNuxtApp()
const toast = useToast()
const { visitaStatusMeta, prioridadeMeta } = useChamadoDisplay()
const { capturar: capturarGeo } = useDeviceGeo()
const { carregar: carregarMotivos, items: motivoItems } = useMotivos()

// ---- Data selecionada (padrão: hoje) ----
const data = ref(format(new Date(), 'yyyy-MM-dd'))
const dataObj = computed(() => parseISO(data.value))
const dataTitulo = computed(() =>
  format(dataObj.value, 'EEEE, d \'de\' MMMM', { locale: ptBR })
)
function diaAnterior() {
  data.value = format(subDays(dataObj.value, 1), 'yyyy-MM-dd')
}
function proximoDia() {
  data.value = format(addDays(dataObj.value, 1), 'yyyy-MM-dd')
}
function hoje() {
  data.value = format(new Date(), 'yyyy-MM-dd')
}

// ---- Rota do dia ----
const itens = ref<RotaItem[]>([])
const loading = ref(false)
async function carregar() {
  loading.value = true
  try {
    itens.value = await $api<RotaItem[]>('/chamados/minha-rota', { query: { data: data.value } })
  } catch {
    toast.add({ title: 'Erro ao carregar a rota do dia', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    loading.value = false
  }
}
watch(data, carregar, { immediate: true })

const ATIVAS = ['solicitado', 'atribuido', 'a_caminho', 'em_atendimento', 'pausado']
const pendentes = computed(() => itens.value.filter(i => ATIVAS.includes(i.visita.status)).length)

// ---- Formatação ----
const hora = (iso: string | null) => (iso ? format(parseISO(iso), 'HH:mm') : '--:--')
function endereco(c: RotaItem['chamado']): string {
  const l1 = [c.logradouro, c.numero].filter(Boolean).join(', ')
  const partes = [
    c.complemento ? `${l1} — ${c.complemento}` : l1,
    c.bairro,
    c.cidadeNome ? (c.uf ? `${c.cidadeNome}/${c.uf}` : c.cidadeNome) : null
  ].filter(Boolean)
  return partes.join(' • ')
}
function mapsUrl(c: RotaItem['chamado']): string {
  if (c.latitude != null && c.longitude != null) {
    return `https://www.google.com/maps?q=${c.latitude},${c.longitude}`
  }
  const q = [c.logradouro, c.numero, c.bairro, c.cidadeNome, c.uf, c.cep].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
const telHref = (t: string) => `tel:${t.replace(/\D/g, '')}`

// ---- Ações (mesmas da ficha do chamado) ----
const agindo = ref<number | null>(null)
async function acao(chamadoId: number, fn: () => Promise<unknown>, sucesso: string) {
  agindo.value = chamadoId
  try {
    await fn()
    toast.add({ title: sucesso, icon: 'i-lucide-check', color: 'success' })
    await carregar()
    return true
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro na ação', icon: 'i-lucide-alert-circle', color: 'error' })
    return false
  } finally {
    agindo.value = null
  }
}

const aceitar = (id: number) =>
  acao(id, () => $api(`/chamados/${id}/aceitar`, { method: 'POST' }), 'Solicitação aceita!')

async function aCaminho(id: number) {
  const geo = await capturarGeo()
  await acao(id, () => $api(`/chamados/${id}/a-caminho`, { method: 'POST', body: { geo } }), 'A caminho')
}

// Chegada: pede código quando o cliente exige.
const checkinOpen = ref(false)
const checkinItem = ref<RotaItem | null>(null)
const checkinCodigo = ref('')
function confirmarChegada(item: RotaItem) {
  if (item.chamado.exigeCodigoCheckin) {
    checkinItem.value = item
    checkinCodigo.value = ''
    checkinOpen.value = true
    return
  }
  return executarChegada(item.chamado.id)
}
async function executarChegada(id: number, codigo?: string) {
  const geo = await capturarGeo()
  const ok = await acao(
    id,
    () => $api(`/chamados/${id}/chegada`, { method: 'POST', body: { geo, codigo: codigo?.trim() || undefined } }),
    'Chegada confirmada'
  )
  if (ok) checkinOpen.value = false
}

const pausarOpen = ref(false)
const pausarId = ref<number | null>(null)
const pausarMotivo = ref('')
const pausarMotivoId = ref(0)
const motivosPausa = ref<Motivo[]>([])
async function abrirPausar(id: number) {
  pausarId.value = id
  pausarMotivo.value = ''
  pausarMotivoId.value = 0
  pausarOpen.value = true
  motivosPausa.value = await carregarMotivos('pausa')
}
async function confirmarPausar() {
  if (!pausarId.value) return
  const id = pausarId.value
  const ok = await acao(
    id,
    () => $api(`/chamados/${id}/pausar`, { method: 'POST', body: { motivo: pausarMotivo.value.trim() || undefined, motivoId: pausarMotivoId.value || undefined } }),
    'Atendimento pausado'
  )
  if (ok) pausarOpen.value = false
}
const retomar = (id: number) =>
  acao(id, () => $api(`/chamados/${id}/retomar`, { method: 'POST' }), 'Atendimento retomado')
</script>

<template>
  <UDashboardPanel id="meu-dia">
    <template #header>
      <UDashboardNavbar title="Meu dia">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UBadge v-if="pendentes" color="info" variant="subtle">
            {{ pendentes }} {{ pendentes === 1 ? 'pendente' : 'pendentes' }}
          </UBadge>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="w-full max-w-2xl mx-auto space-y-4">
        <!-- Seletor de data -->
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="subtle"
            aria-label="Dia anterior"
            @click="diaAnterior"
          />
          <UInput v-model="data" type="date" class="flex-1" />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="subtle"
            aria-label="Próximo dia"
            @click="proximoDia"
          />
          <UButton
            v-if="!isToday(dataObj)"
            label="Hoje"
            color="neutral"
            variant="ghost"
            @click="hoje"
          />
        </div>
        <p class="text-sm text-muted capitalize">
          {{ dataTitulo }}
        </p>

        <UProgress v-if="loading" animation="carousel" size="xs" />

        <div v-if="!loading && !itens.length" class="py-16 text-center text-sm text-muted">
          <UIcon name="i-lucide-coffee" class="size-8 mx-auto mb-2 text-dimmed" />
          Nenhuma visita agendada para este dia.
        </div>

        <!-- Cards da rota -->
        <ol class="space-y-3">
          <li
            v-for="(item, idx) in itens"
            :key="item.visita.id"
            class="rounded-xl border border-default bg-elevated/40 p-4 space-y-3"
            :class="{ 'opacity-60': ['finalizado', 'cancelado'].includes(item.visita.status) }"
          >
            <!-- Linha 1: ordem, hora, status -->
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-3">
                <span class="size-8 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center shrink-0">
                  {{ item.visita.ordemRota ?? idx + 1 }}
                </span>
                <div>
                  <p class="text-lg font-semibold text-highlighted leading-tight">
                    {{ hora(item.visita.agendadoPara) }}
                    <span v-if="item.visita.duracaoPrevistaMin" class="text-xs text-muted font-normal">
                      • {{ item.visita.duracaoPrevistaMin }} min
                    </span>
                  </p>
                  <p class="text-xs text-muted">
                    {{ item.chamado.codigo }}
                    <span v-if="item.visita.numero > 1"> • Visita {{ item.visita.numero }}</span>
                  </p>
                </div>
              </div>
              <div class="flex flex-col items-end gap-1">
                <UBadge :color="visitaStatusMeta(item.visita.status).color" variant="subtle">
                  {{ visitaStatusMeta(item.visita.status).label }}
                </UBadge>
                <UBadge :color="prioridadeMeta(item.chamado.prioridade).color" variant="outline" size="sm">
                  {{ prioridadeMeta(item.chamado.prioridade).label }}
                </UBadge>
                <UBadge
                  v-if="item.chamado.slaPrimeiraVisitaEstourado || item.chamado.slaConclusaoEstourado"
                  color="error"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-timer-off"
                >
                  SLA estourado
                </UBadge>
              </div>
            </div>

            <!-- Cliente / título -->
            <div>
              <p class="font-medium text-highlighted">
                {{ item.chamado.clienteNome ?? 'Cliente' }}
              </p>
              <p class="text-sm text-muted">
                {{ item.chamado.titulo }}
              </p>
            </div>

            <!-- Endereço -->
            <a
              :href="mapsUrl(item.chamado)"
              target="_blank"
              rel="noopener"
              class="flex items-start gap-2 text-sm text-highlighted hover:text-primary"
            >
              <UIcon name="i-lucide-map-pin" class="size-4 mt-0.5 shrink-0 text-primary" />
              <span>
                {{ endereco(item.chamado) || 'Endereço não informado' }}
                <span v-if="item.chamado.pontoReferencia" class="block text-xs text-muted">
                  Ref.: {{ item.chamado.pontoReferencia }}
                </span>
                <span class="block text-xs text-primary">Abrir no Google Maps</span>
              </span>
            </a>

            <!-- Contato -->
            <div
              v-if="item.chamado.contatoLocalNome || item.chamado.contatoLocalTelefone || item.chamado.clienteTelefone"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
            >
              <span class="text-muted flex items-center gap-1">
                <UIcon name="i-lucide-contact" class="size-4" />
                {{ item.chamado.contatoLocalNome ?? 'Cliente' }}
              </span>
              <a
                v-if="item.chamado.contatoLocalTelefone ?? item.chamado.clienteTelefone"
                :href="telHref((item.chamado.contatoLocalTelefone ?? item.chamado.clienteTelefone)!)"
                class="text-primary hover:underline flex items-center gap-1"
              >
                <UIcon name="i-lucide-phone" class="size-4" />
                {{ item.chamado.contatoLocalTelefone ?? item.chamado.clienteTelefone }}
              </a>
            </div>

            <p
              v-if="item.chamado.exigeCodigoCheckin || item.chamado.exigeCodigoCheckout"
              class="text-xs text-warning flex items-center gap-1"
            >
              <UIcon name="i-lucide-key-round" class="size-3.5" />
              Cliente exige código no
              {{ [item.chamado.exigeCodigoCheckin ? 'check-in' : null, item.chamado.exigeCodigoCheckout ? 'check-out' : null].filter(Boolean).join(' e ') }}.
            </p>

            <!-- Ações grandes -->
            <div class="grid grid-cols-2 gap-2 pt-1">
              <UButton
                v-if="item.visita.status === 'solicitado'"
                label="Aceitar"
                icon="i-lucide-check"
                color="success"
                size="lg"
                block
                :loading="agindo === item.chamado.id"
                @click="aceitar(item.chamado.id)"
              />
              <UButton
                v-if="item.visita.status === 'atribuido'"
                label="A caminho"
                icon="i-lucide-navigation"
                color="info"
                size="lg"
                block
                :loading="agindo === item.chamado.id"
                @click="aCaminho(item.chamado.id)"
              />
              <UButton
                v-if="['atribuido', 'a_caminho'].includes(item.visita.status)"
                label="Cheguei"
                icon="i-lucide-map-pin-check"
                color="info"
                size="lg"
                block
                :variant="item.visita.status === 'a_caminho' ? 'solid' : 'subtle'"
                :loading="agindo === item.chamado.id"
                @click="confirmarChegada(item)"
              />
              <UButton
                v-if="item.visita.status === 'em_atendimento'"
                label="Pausar"
                icon="i-lucide-pause"
                color="warning"
                variant="subtle"
                size="lg"
                block
                :loading="agindo === item.chamado.id"
                @click="abrirPausar(item.chamado.id)"
              />
              <UButton
                v-if="item.visita.status === 'pausado'"
                label="Retomar"
                icon="i-lucide-play"
                color="info"
                size="lg"
                block
                :loading="agindo === item.chamado.id"
                @click="retomar(item.chamado.id)"
              />
              <UButton
                v-if="item.visita.status === 'em_atendimento'"
                label="Finalizar"
                icon="i-lucide-check-check"
                color="primary"
                size="lg"
                block
                :to="`/chamados/${item.chamado.id}`"
              />
              <UButton
                label="Ver chamado"
                icon="i-lucide-external-link"
                color="neutral"
                variant="ghost"
                size="lg"
                block
                class="col-span-2"
                :to="`/chamados/${item.chamado.id}`"
              />
            </div>
          </li>
        </ol>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal: código de check-in -->
  <UModal v-model:open="checkinOpen" title="Confirmar chegada">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          <strong class="text-highlighted">{{ checkinItem?.chamado.clienteNome }}</strong>
          exige um código de check-in. Peça ao contato no local.
        </p>
        <UFormField label="Código de check-in" required>
          <UInput
            v-model="checkinCodigo"
            class="w-full"
            size="lg"
            autocomplete="off"
            autofocus
            @keydown.enter.prevent="checkinCodigo.trim() && checkinItem && executarChegada(checkinItem.chamado.id, checkinCodigo)"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Voltar"
            color="neutral"
            variant="subtle"
            @click="checkinOpen = false"
          />
          <UButton
            label="Confirmar chegada"
            icon="i-lucide-map-pin-check"
            color="info"
            :disabled="!checkinCodigo.trim()"
            :loading="agindo !== null"
            @click="checkinItem && executarChegada(checkinItem.chamado.id, checkinCodigo)"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: pausar -->
  <UModal v-model:open="pausarOpen" title="Pausar atendimento">
    <template #body>
      <div class="space-y-4">
        <UFormField v-if="motivosPausa.length" label="Classificação" help="Opcional">
          <USelect v-model="pausarMotivoId" :items="motivoItems(motivosPausa)" class="w-full" />
        </UFormField>
        <UFormField label="Motivo" help="Opcional — o tempo em pausa é descontado das horas">
          <UTextarea
            v-model="pausarMotivo"
            class="w-full"
            :rows="2"
            placeholder="Ex.: almoço, aguardando peça…"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Voltar"
            color="neutral"
            variant="subtle"
            @click="pausarOpen = false"
          />
          <UButton
            label="Pausar"
            icon="i-lucide-pause"
            color="warning"
            :loading="agindo !== null"
            @click="confirmarPausar"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
