<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone, today } from '@internationalized/date'
import type { DateRangeYmd } from '~/types'

const props = defineProps<{
  label?: string
  placeholder?: string
  /** Cor do ícone/realce (diferencia criado/agendado/finalizado). */
  color?: string
}>()

// v-model: { de: 'YYYY-MM-DD', ate: 'YYYY-MM-DD' } (strings vazias = sem filtro).
const model = defineModel<DateRangeYmd>({ default: () => ({ de: '', ate: '' }) })

const df = new DateFormatter('pt-BR', { dateStyle: 'short' })

function ymdToCalendar(ymd: string): CalendarDate | undefined {
  if (!ymd) return undefined
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new CalendarDate(y, m, d)
}
function calendarToYmd(c: CalendarDate | null | undefined): string {
  if (!c) return ''
  return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`
}

const calendarRange = computed({
  get: () => ({
    start: ymdToCalendar(model.value.de),
    end: ymdToCalendar(model.value.ate)
  }),
  set: (v: { start: CalendarDate | null, end: CalendarDate | null }) => {
    model.value = { de: calendarToYmd(v.start), ate: calendarToYmd(v.end) }
  }
})

const hasValue = computed(() => !!(model.value.de || model.value.ate))

const displayLabel = computed(() => {
  const { de, ate } = model.value
  if (!de && !ate) return props.placeholder ?? 'Qualquer data'
  const fmt = (ymd: string) => {
    const c = ymdToCalendar(ymd)
    return c ? df.format(c.toDate(getLocalTimeZone())) : '…'
  }
  if (de && ate) return `${fmt(de)} – ${fmt(ate)}`
  if (de) return `A partir de ${fmt(de)}`
  return `Até ${fmt(ate)}`
})

const presets = [
  { label: 'Hoje', days: 0 },
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Este mês', month: true }
]
function aplicarPreset(p: { days?: number, month?: boolean }) {
  const hoje = today(getLocalTimeZone())
  if (p.month) {
    const inicio = new CalendarDate(hoje.year, hoje.month, 1)
    model.value = { de: calendarToYmd(inicio), ate: calendarToYmd(hoje) }
    return
  }
  const inicio = hoje.subtract({ days: p.days ?? 0 })
  model.value = { de: calendarToYmd(inicio), ate: calendarToYmd(hoje) }
}
function limpar() {
  model.value = { de: '', ate: '' }
}
</script>

<template>
  <div>
    <label v-if="label" class="block text-sm text-muted mb-1">{{ label }}</label>
    <UPopover :content="{ align: 'start' }">
      <UButton
        color="neutral"
        variant="outline"
        class="w-full justify-start"
        :class="hasValue ? 'ring-2 ring-inset' : ''"
      >
        <UIcon name="i-lucide-calendar" class="size-4 shrink-0" :style="color ? { color } : undefined" />
        <span class="truncate" :class="hasValue ? 'text-highlighted' : 'text-muted'">
          {{ displayLabel }}
        </span>
        <template v-if="hasValue" #trailing>
          <UIcon
            name="i-lucide-x"
            class="size-4 text-dimmed hover:text-highlighted ms-auto"
            @click.stop="limpar"
          />
        </template>
      </UButton>

      <template #content>
        <div class="flex items-stretch sm:divide-x divide-default">
          <div class="hidden sm:flex flex-col justify-center py-1">
            <UButton
              v-for="p in presets"
              :key="p.label"
              :label="p.label"
              color="neutral"
              variant="ghost"
              class="rounded-none px-4 justify-start"
              truncate
              @click="aplicarPreset(p)"
            />
            <UButton
              label="Limpar"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="rounded-none px-4 justify-start text-dimmed"
              @click="limpar"
            />
          </div>
          <UCalendar v-model="calendarRange" class="p-2" :number-of-months="2" range />
        </div>
      </template>
    </UPopover>
  </div>
</template>
