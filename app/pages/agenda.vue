<script setup lang="ts">
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
  parseISO,
  isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AgendaItem, ChamadoStatus } from '~/types'

definePageMeta({ permission: 'agenda.ver' })

const { $api } = useNuxtApp()
const { can } = usePermissions()
const { statusMeta } = useChamadoDisplay()
const toast = useToast()

const podeGerenciar = can('agenda.gerenciar')

// ---- Mês atual ----
const mesAtual = ref(new Date())

const mesTitulo = computed(() =>
  format(mesAtual.value, 'MMMM yyyy', { locale: ptBR }),
)

function mesAnterior() { mesAtual.value = subMonths(mesAtual.value, 1) }
function proximoMes() { mesAtual.value = addMonths(mesAtual.value, 1) }
function irParaHoje() { mesAtual.value = new Date() }

// ---- Grade de dias ----
const dias = computed(() => {
  const inicio = startOfWeek(startOfMonth(mesAtual.value), { weekStartsOn: 0 })
  const fim = endOfWeek(endOfMonth(mesAtual.value), { weekStartsOn: 0 })
  return eachDayOfInterval({ start: inicio, end: fim })
})

// ---- Fetch ----
const items = ref<AgendaItem[]>([])
const loading = ref(false)

async function carregar() {
  loading.value = true
  try {
    const de = format(startOfMonth(mesAtual.value), 'yyyy-MM-dd')
    const ate = format(endOfMonth(mesAtual.value), 'yyyy-MM-dd')
    items.value = await $api<AgendaItem[]>('/chamados/agenda', { query: { de, ate } })
  } catch {
    toast.add({ title: 'Erro ao carregar agenda', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    loading.value = false
  }
}

watch(mesAtual, carregar, { immediate: true })

// Itens agrupados por dia (chave: YYYY-MM-DD local)
const itensPorDia = computed(() => {
  const map = new Map<string, AgendaItem[]>()
  for (const item of items.value) {
    // Converte o ISO para data local de Brasília (o campo é timestamptz)
    const local = new Date(item.agendadoPara)
    const key = format(local, 'yyyy-MM-dd')
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return map
})

function itensNoDia(dia: Date): AgendaItem[] {
  return itensPorDia.value.get(format(dia, 'yyyy-MM-dd')) ?? []
}

// Hora local formatada
function horaLocal(iso: string): string {
  return format(parseISO(iso), 'HH:mm')
}

// Endereço curto
function enderecoResumido(item: AgendaItem): string {
  const partes: string[] = []
  if (item.logradouro) partes.push(item.numero ? `${item.logradouro}, ${item.numero}` : item.logradouro)
  else if (item.bairro) partes.push(item.bairro)
  if (item.cidadeNome) partes.push(item.uf ? `${item.cidadeNome}/${item.uf}` : item.cidadeNome)
  return partes.join(' — ')
}

// ---- Popover de detalhes / reagendamento ----
const eventoSelecionado = ref<AgendaItem | null>(null)
const popoverAberto = ref(false)

function abrirEvento(item: AgendaItem) {
  eventoSelecionado.value = item
  popoverAberto.value = true
}

// ---- Reagendamento ----
const reagendando = ref(false)
const novaDataHora = ref('')

function abrirReagendar(item: AgendaItem) {
  novaDataHora.value = item.agendadoPara
    ? format(parseISO(item.agendadoPara), "yyyy-MM-dd'T'HH:mm")
    : ''
  reagendando.value = true
}

async function confirmarReagendar() {
  if (!eventoSelecionado.value) return
  try {
    await $api(`/chamados/${eventoSelecionado.value.id}/reagendar`, {
      method: 'PATCH',
      body: { agendadoPara: novaDataHora.value ? new Date(novaDataHora.value).toISOString() : null },
    })
    toast.add({ title: 'Reagendado com sucesso', icon: 'i-lucide-check', color: 'success' })
    popoverAberto.value = false
    reagendando.value = false
    await carregar()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro ao reagendar', icon: 'i-lucide-alert-circle', color: 'error' })
  }
}

// Limite de eventos visíveis por célula antes do "+N"
const LIMITE_CELULA = 3

// Cores de dot por status
const STATUS_DOT: Record<ChamadoStatus, string> = {
  aberto: 'bg-neutral-400',
  solicitado: 'bg-warning-400',
  atribuido: 'bg-info-400',
  a_caminho: 'bg-info-500',
  em_atendimento: 'bg-warning-500',
  finalizado: 'bg-primary-500',
  fechado: 'bg-success-500',
  cancelado: 'bg-error-500',
}

function dotClass(status: ChamadoStatus): string {
  return STATUS_DOT[status] ?? 'bg-neutral-400'
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Agenda">
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              v-if="!isToday(mesAtual)"
              variant="ghost"
              size="sm"
              label="Hoje"
              icon="i-lucide-calendar"
              @click="irParaHoje"
            />
            <UButton variant="ghost" size="sm" icon="i-lucide-chevron-left" @click="mesAnterior" />
            <span class="text-sm font-medium capitalize min-w-36 text-center">{{ mesTitulo }}</span>
            <UButton variant="ghost" size="sm" icon="i-lucide-chevron-right" @click="proximoMes" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <div class="h-full flex flex-col p-4 gap-4">
      <!-- Cabeçalho dos dias da semana -->
      <div class="grid grid-cols-7 gap-px">
        <div
          v-for="dia in DIAS_SEMANA"
          :key="dia"
          class="text-center text-xs font-semibold text-muted uppercase py-2"
        >
          {{ dia }}
        </div>
      </div>

      <!-- Indicador de carregamento -->
      <UProgress v-if="loading" animation="carousel" class="absolute top-0 left-0 right-0 z-10" />

      <!-- Grade mensal -->
      <div class="grid grid-cols-7 gap-px flex-1 bg-default border border-default rounded-lg overflow-hidden">
        <div
          v-for="dia in dias"
          :key="dia.toISOString()"
          class="bg-elevated min-h-28 p-1.5 flex flex-col gap-1"
          :class="{ 'opacity-40': !isSameMonth(dia, mesAtual) }"
        >
          <!-- Número do dia -->
          <div class="flex justify-end">
            <span
              class="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full"
              :class="isToday(dia) ? 'bg-primary text-white' : 'text-muted'"
            >
              {{ format(dia, 'd') }}
            </span>
          </div>

          <!-- Eventos do dia -->
          <template v-if="itensNoDia(dia).length">
            <button
              v-for="item in itensNoDia(dia).slice(0, LIMITE_CELULA)"
              :key="item.id"
              class="w-full text-left rounded px-1.5 py-0.5 flex items-center gap-1.5 text-xs truncate hover:bg-default transition-colors"
              :class="isSameMonth(dia, mesAtual) ? 'text-highlighted' : 'text-muted'"
              @click="abrirEvento(item)"
            >
              <span class="w-2 h-2 rounded-full shrink-0" :class="dotClass(item.status)" />
              <span class="font-medium shrink-0">{{ horaLocal(item.agendadoPara) }}</span>
              <span class="truncate">{{ item.clienteNome ?? item.titulo }}</span>
            </button>

            <!-- Overflow -->
            <button
              v-if="itensNoDia(dia).length > LIMITE_CELULA"
              class="w-full text-left text-xs text-muted px-1.5 py-0.5 hover:text-highlighted transition-colors"
              @click="abrirEvento(itensNoDia(dia)[LIMITE_CELULA]!)"
            >
              mais {{ itensNoDia(dia).length - LIMITE_CELULA }}
            </button>
          </template>
        </div>
      </div>

      <!-- Rodapé: legenda de status -->
      <div class="flex flex-wrap gap-4 text-xs text-muted pt-1">
        <div v-for="(meta, key) in { aberto: statusMeta('aberto'), atribuido: statusMeta('atribuido'), a_caminho: statusMeta('a_caminho'), em_atendimento: statusMeta('em_atendimento'), finalizado: statusMeta('finalizado'), fechado: statusMeta('fechado') }" :key="key" class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full" :class="dotClass(key as ChamadoStatus)" />
          {{ meta.label }}
        </div>
      </div>
    </div>
  </UDashboardPanel>

  <!-- Slideover de detalhes do evento -->
  <USlideover
    v-model:open="popoverAberto"
    :title="eventoSelecionado?.codigo ?? 'Atendimento'"
    description="Detalhes do atendimento agendado"
    side="right"
    @update:open="reagendando = false"
  >
    <template v-if="eventoSelecionado" #body>
      <div class="flex flex-col gap-5 py-2">
        <!-- Status + Prioridade -->
        <div class="flex items-center gap-2">
          <UBadge :color="statusMeta(eventoSelecionado.status).color" variant="subtle">
            {{ statusMeta(eventoSelecionado.status).label }}
          </UBadge>
          <UBadge color="neutral" variant="outline">
            {{ eventoSelecionado.prioridade }}
          </UBadge>
        </div>

        <!-- Título -->
        <div>
          <p class="text-xs text-muted mb-0.5">Título</p>
          <p class="text-sm font-medium">{{ eventoSelecionado.titulo }}</p>
        </div>

        <!-- Horário agendado -->
        <div>
          <p class="text-xs text-muted mb-0.5">Agendado para</p>
          <p class="text-sm font-medium">
            {{ format(parseISO(eventoSelecionado.agendadoPara), "dd/MM/yyyy 'às' HH:mm") }}
          </p>
        </div>

        <!-- Cliente -->
        <div v-if="eventoSelecionado.clienteNome">
          <p class="text-xs text-muted mb-0.5">Cliente</p>
          <p class="text-sm">{{ eventoSelecionado.clienteNome }}</p>
        </div>

        <!-- Técnico -->
        <div v-if="eventoSelecionado.tecnicoNome">
          <p class="text-xs text-muted mb-0.5">Técnico</p>
          <p class="text-sm">{{ eventoSelecionado.tecnicoNome }}</p>
        </div>

        <!-- Local -->
        <div v-if="enderecoResumido(eventoSelecionado)">
          <p class="text-xs text-muted mb-0.5">Local</p>
          <p class="text-sm">{{ enderecoResumido(eventoSelecionado) }}</p>
        </div>

        <!-- Formulário de reagendamento -->
        <template v-if="podeGerenciar && reagendando">
          <UDivider />
          <div class="flex flex-col gap-3">
            <p class="text-sm font-semibold">Nova data e hora</p>
            <UInput
              v-model="novaDataHora"
              type="datetime-local"
            />
            <div class="flex gap-2">
              <UButton class="flex-1" @click="confirmarReagendar">Confirmar</UButton>
              <UButton variant="ghost" class="flex-1" @click="reagendando = false">Cancelar</UButton>
            </div>
          </div>
        </template>
      </div>
    </template>

    <template v-if="eventoSelecionado" #footer>
      <div class="flex gap-2 w-full">
        <UButton
          variant="ghost"
          class="flex-1"
          icon="i-lucide-external-link"
          :to="`/chamados/${eventoSelecionado.id}`"
          label="Ver chamado"
          @click="popoverAberto = false"
        />
        <UButton
          v-if="podeGerenciar && !reagendando"
          class="flex-1"
          icon="i-lucide-calendar-clock"
          label="Reagendar"
          @click="abrirReagendar(eventoSelecionado)"
        />
      </div>
    </template>
  </USlideover>
</template>
