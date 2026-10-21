<script setup lang="ts">
/**
 * Área de assinatura (canvas) com pointer events — funciona com mouse, toque
 * e caneta. Expõe `isEmpty()`, `clear()` e `toBlob()` (PNG) para o pai.
 */
const props = withDefaults(defineProps<{
  height?: number
  disabled?: boolean
}>(), { height: 180, disabled: false })

const emit = defineEmits<{ change: [empty: boolean] }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const vazio = ref(true)
let ctx: CanvasRenderingContext2D | null = null
let desenhando = false
let ultimo: { x: number, y: number } | null = null

function ajustarResolucao() {
  const canvas = canvasRef.value
  const wrap = wrapperRef.value
  if (!canvas || !wrap) return
  // Preserva o traço ao redimensionar.
  const prev = vazio.value ? null : canvas.toDataURL()
  const ratio = window.devicePixelRatio || 1
  const width = wrap.clientWidth
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(props.height * ratio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${props.height}px`
  ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(ratio, ratio)
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#111827'
  if (prev) {
    const img = new Image()
    img.onload = () => ctx?.drawImage(img, 0, 0, width, props.height)
    img.src = prev
  }
}

function pos(e: PointerEvent) {
  const rect = canvasRef.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onDown(e: PointerEvent) {
  if (props.disabled || !ctx) return
  e.preventDefault()
  canvasRef.value?.setPointerCapture(e.pointerId)
  desenhando = true
  ultimo = pos(e)
  // Ponto único (toque rápido) também conta como traço.
  ctx.beginPath()
  ctx.arc(ultimo.x, ultimo.y, 1, 0, Math.PI * 2)
  ctx.fillStyle = ctx.strokeStyle
  ctx.fill()
  marcarPreenchido()
}

function onMove(e: PointerEvent) {
  if (!desenhando || !ctx || !ultimo) return
  e.preventDefault()
  const p = pos(e)
  ctx.beginPath()
  ctx.moveTo(ultimo.x, ultimo.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  ultimo = p
}

function onUp(e: PointerEvent) {
  if (!desenhando) return
  desenhando = false
  ultimo = null
  canvasRef.value?.releasePointerCapture(e.pointerId)
}

function marcarPreenchido() {
  if (vazio.value) {
    vazio.value = false
    emit('change', false)
  }
}

function clear() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
  vazio.value = true
  emit('change', true)
}

function isEmpty() {
  return vazio.value
}

/** PNG com fundo branco (o canvas é transparente). */
function toBlob(): Promise<Blob | null> {
  const canvas = canvasRef.value
  if (!canvas) return Promise.resolve(null)
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const octx = out.getContext('2d')!
  octx.fillStyle = '#ffffff'
  octx.fillRect(0, 0, out.width, out.height)
  // Cast: o ref do Vue 'desembrulha' o tipo DOM e perde CanvasImageSource.
  octx.drawImage(canvas as unknown as HTMLCanvasElement, 0, 0)
  return new Promise<Blob | null>((resolve) => {
    out.toBlob((b: Blob | null) => resolve(b), 'image/png')
  })
}

defineExpose({ clear, isEmpty, toBlob })

let ro: ResizeObserver | null = null
onMounted(() => {
  ajustarResolucao()
  if (wrapperRef.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(() => ajustarResolucao())
    ro.observe(wrapperRef.value as unknown as Element)
  }
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div ref="wrapperRef" class="relative w-full">
    <canvas
      ref="canvasRef"
      class="w-full rounded-lg border border-dashed border-default bg-white touch-none select-none"
      :class="disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-crosshair'"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onUp"
    />
    <p
      v-if="vazio"
      class="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none"
    >
      Assine aqui
    </p>
    <UButton
      v-if="!vazio && !disabled"
      icon="i-lucide-eraser"
      label="Limpar"
      size="xs"
      color="neutral"
      variant="subtle"
      class="absolute top-2 right-2"
      @click="clear"
    />
  </div>
</template>
