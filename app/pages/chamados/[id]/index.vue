<script setup lang="ts">
import type {
  AppConfig,
  Chamado,
  ChamadoEvent,
  ChamadoLineItem,
  ChamadoRat,
  ChamadoVisita,
  ChamadoComentario,
  ClientLocal,
  FinalizarPayload,
  FinanceiroConfig,
  Paginated,
  Motivo,
  MotivoTipo,
  PreviaFinalizacao,
  Servico,
  TechnicianListItem,
  UpdateChamadoPayload
} from '~/types'

definePageMeta({ permission: 'atendimentos.ver' })

const route = useRoute()
const { $api } = useNuxtApp()
const { can } = usePermissions()
const { user } = useAuth()
const toast = useToast()
const { statusMeta, visitaStatusMeta, prioridadeMeta, paymentMeta, eventLabel, brl, pct }
  = useChamadoDisplay()
const { capturar: capturarGeo } = useDeviceGeo()
const { carregar: carregarMotivos, items: motivoItems } = useMotivos()

const id = Number(route.params.id)
const podeGerenciar = can('atendimentos.gerenciar')
const podeVerHistorico = can('atendimentos.ver_historico')
const podeFin = can('financeiro.ver')
const podeFinGerenciar = can('financeiro.gerenciar')
const podeFinProprio = can('financeiro.ver_proprio')

const {
  data: chamado,
  refresh,
  error
} = await useAsyncData(`chamado-${id}`, () => $api<Chamado>(`/chamados/${id}`))
const { data: eventos, refresh: refreshEventos } = await useAsyncData(
  `chamado-${id}-eventos`,
  () => $api<ChamadoEvent[]>(`/chamados/${id}/eventos`)
)
const { data: rats, refresh: refreshRats } = await useAsyncData(
  `chamado-${id}-rats`,
  () => $api<ChamadoRat[]>(`/chamados/${id}/rats`)
)

// É o técnico dono do chamado?
const isDono = computed(() => chamado.value?.tecnicoUserId === user.value?.id)
const podeVerComprovantes = computed(() => podeFin || (isDono.value && podeFinProprio))
// Ações do técnico: o próprio dono ou o gestor agindo em nome dele.
const podeAgirComoTecnico = computed(() => isDono.value || podeGerenciar)

// Configuração operacional (assinatura obrigatória, avaliação…). Quem não tem
// configuracoes.ver recebe 403 — tratamos tudo como opcional nesse caso.
const appConfig = ref<AppConfig | null>(null)
if (can('configuracoes.ver')) {
  $api<AppConfig>('/configuracoes')
    .then((c) => { appConfig.value = c })
    .catch(() => { appConfig.value = null })
}
const assinaturaObrigatoria = computed(() => appConfig.value?.assinaturaObrigatoria ?? false)
const avaliacaoHabilitada = computed(() => appConfig.value?.avaliacaoHabilitada ?? true)

// ---- Helpers de formatação ----
const fmtDataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const fmtDuracao = (min: number | null | undefined) => {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m} min`
}
const fmtDistancia = (m: number | null | undefined) =>
  m == null ? '—' : m >= 1000 ? `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`
const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`
// datetime-local -> ISO (ou undefined quando vazio).
const toIsoOrUndefined = (v: string) => (v ? new Date(v).toISOString() : undefined)

async function reloadAll() {
  await Promise.all([refresh(), refreshEventos(), refreshRats()])
}

async function acao(fn: () => Promise<unknown>, sucesso: string) {
  try {
    await fn()
    toast.add({ title: sucesso, icon: 'i-lucide-check', color: 'success' })
    await reloadAll()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message)
      ? err.data.message[0]
      : err?.data?.message
    toast.add({
      title: msg ?? 'Erro na ação',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  }
}

// ---- Comentários ----
const { data: comentarios, refresh: refreshComentarios } = await useAsyncData(
  `chamado-${id}-comentarios`,
  () => $api<ChamadoComentario[]>(`/chamados/${id}/comentarios`),
  { default: () => [] as ChamadoComentario[] }
)
const comentarioTexto = ref('')
const enviandoComentario = ref(false)
const removendoComentario = ref<number | null>(null)
async function enviarComentario() {
  const texto = comentarioTexto.value.trim()
  if (!texto) return
  enviandoComentario.value = true
  try {
    await $api(`/chamados/${id}/comentarios`, { method: 'POST', body: { texto } })
    comentarioTexto.value = ''
    await Promise.all([refreshComentarios(), refreshEventos()])
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] } }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? 'Erro ao comentar', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    enviandoComentario.value = false
  }
}
async function removerComentario(c: ChamadoComentario) {
  const ok = await confirm({
    title: 'Excluir comentário',
    message: 'Excluir este comentário? Esta ação não pode ser desfeita.',
    confirmLabel: 'Excluir',
    confirmColor: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  removendoComentario.value = c.id
  try {
    await $api(`/chamados/${id}/comentarios/${c.id}`, { method: 'DELETE' })
    await refreshComentarios()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({ title: err?.data?.message ?? 'Erro ao excluir comentário', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    removendoComentario.value = null
  }
}

// ---- SLA ----
// Situação de cada prazo: estourado / cumprido / tempo restante.
function slaStatus(prazo: string | null, marco: string | null, estourado: boolean) {
  if (!prazo) return null
  if (estourado) return { label: 'estourado', color: 'error' as const, detalhe: fmtDataHora(prazo) }
  if (marco) return { label: 'cumprido', color: 'success' as const, detalhe: fmtDataHora(marco) }
  const restMs = new Date(prazo).getTime() - Date.now()
  const h = Math.floor(restMs / 3_600_000)
  const label = h >= 48 ? `${Math.floor(h / 24)} d restantes` : `${Math.max(0, h)} h restantes`
  return { label, color: (h < 4 ? 'warning' : 'info') as 'warning' | 'info', detalhe: fmtDataHora(prazo) }
}
const slaPrimeira = computed(() => {
  const c = chamado.value
  return c ? slaStatus(c.prazoPrimeiraVisita, c.primeiraVisitaEm, c.slaPrimeiraVisitaEstourado) : null
})
const slaConclusao = computed(() => {
  const c = chamado.value
  return c ? slaStatus(c.prazoConclusao, c.finalizadoEm, c.slaConclusaoEstourado) : null
})

// ---- Arquivar / desarquivar (gestor; só fechado/cancelado) ----
const podeArquivar = computed(
  () => podeGerenciar && !!chamado.value && ['fechado', 'cancelado'].includes(chamado.value.status)
)
const arquivar = () =>
  acao(() => $api(`/chamados/${id}/arquivar`, { method: 'POST' }), 'Chamado arquivado')
const desarquivar = () =>
  acao(() => $api(`/chamados/${id}/desarquivar`, { method: 'POST' }), 'Chamado desarquivado')

// ---- Serviços do catálogo (edição) ----
const { data: servicos } = await useAsyncData(
  'servicos-para-chamado',
  () => can('servicos.ver')
    ? $api<Servico[]>('/servicos').catch(() => [] as Servico[])
    : Promise.resolve([] as Servico[]),
  { default: () => [] as Servico[] }
)
const servicoItems = computed(() => [
  { label: 'Sem serviço do catálogo', value: 0 },
  ...(servicos.value ?? []).map(sv => ({ label: sv.nome, value: sv.id }))
])

// ---- Atribuir técnico ----
const atribuirOpen = ref(false)
const tecnicoSel = ref<number | undefined>()
const chamadaFixa = ref<number | undefined>()
const atribAgendadoPara = ref('')
const atribDuracao = ref<number | undefined>()
function abrirAtribuir() {
  atribAgendadoPara.value = toDatetimeLocal(chamado.value?.agendadoPara ?? null)
  atribDuracao.value = chamado.value?.visitaAtual?.duracaoPrevistaMin ?? undefined
  atribuirOpen.value = true
}
const { data: tecnicos } = await useAsyncData(
  'tecnicos-para-atribuir',
  () =>
    podeGerenciar
      ? $api<Paginated<TechnicianListItem>>('/technicians', {
          params: { pageSize: 200 }
        }).then(r => r.items)
      : Promise.resolve([] as TechnicianListItem[]),
  { default: () => [] as TechnicianListItem[] }
)
// Só técnicos ativos podem receber novas visitas.
const tecnicosAtivos = computed(() => (tecnicos.value ?? []).filter(t => t.isActive))
async function confirmarAtribuir() {
  if (!tecnicoSel.value) return
  await acao(
    () =>
      $api(`/chamados/${id}/atribuir`, {
        method: 'POST',
        body: {
          tecnicoUserId: tecnicoSel.value,
          chamadaFixa: chamadaFixa.value || undefined,
          agendadoPara: toIsoOrUndefined(atribAgendadoPara.value),
          duracaoPrevistaMin: atribDuracao.value || undefined
        }
      }),
    'Técnico atribuído'
  )
  atribuirOpen.value = false
  chamadaFixa.value = undefined
}

// ---- Visitas ----
const VISITA_ATIVA = ['solicitado', 'atribuido', 'a_caminho', 'em_atendimento', 'pausado']
const visitas = computed<ChamadoVisita[]>(() => chamado.value?.visitas ?? [])
const visitaAtual = computed<ChamadoVisita | null>(() => chamado.value?.visitaAtual ?? null)
const visitaAtualAtiva = computed(
  () => !!visitaAtual.value && VISITA_ATIVA.includes(visitaAtual.value.status)
)
// Nova visita (retorno): visita atual encerrada e chamado ainda não fechado/cancelado.
const podeNovaVisita = computed(() => {
  const c = chamado.value
  if (!c || !podeGerenciar) return false
  if (['fechado', 'cancelado'].includes(c.status)) return false
  if (!visitaAtual.value) return visitas.value.some(v => v.status === 'cancelado')
  return ['finalizado', 'cancelado'].includes(visitaAtual.value.status)
})

const novaVisitaOpen = ref(false)
const salvandoVisita = ref(false)
const novaVisitaForm = reactive({
  tecnicoUserId: undefined as number | undefined,
  agendadoPara: '',
  duracaoPrevistaMin: undefined as number | undefined,
  chamadaFixa: undefined as number | undefined,
  observacao: ''
})
function abrirNovaVisita() {
  novaVisitaForm.tecnicoUserId = chamado.value?.tecnicoUserId ?? undefined
  novaVisitaForm.agendadoPara = ''
  novaVisitaForm.duracaoPrevistaMin = visitaAtual.value?.duracaoPrevistaMin ?? undefined
  novaVisitaForm.chamadaFixa = undefined
  novaVisitaForm.observacao = ''
  novaVisitaOpen.value = true
}
async function confirmarNovaVisita() {
  if (!novaVisitaForm.tecnicoUserId) return
  salvandoVisita.value = true
  try {
    await acao(
      () =>
        $api(`/chamados/${id}/visitas`, {
          method: 'POST',
          body: {
            tecnicoUserId: novaVisitaForm.tecnicoUserId,
            agendadoPara: toIsoOrUndefined(novaVisitaForm.agendadoPara),
            duracaoPrevistaMin: novaVisitaForm.duracaoPrevistaMin || undefined,
            chamadaFixa: novaVisitaForm.chamadaFixa || undefined,
            observacao: novaVisitaForm.observacao.trim() || undefined
          }
        }),
      'Nova visita criada'
    )
    novaVisitaOpen.value = false
  } finally {
    salvandoVisita.value = false
  }
}

const assinaturaAbrindo = ref<number | null>(null)
async function abrirAssinatura(visitaId: number) {
  assinaturaAbrindo.value = visitaId
  try {
    const { signedUrl } = await $api<{ signedUrl: string }>(
      `/chamados/${id}/visitas/${visitaId}/assinatura/download-url`
    )
    window.open(signedUrl, '_blank', 'noopener')
  } catch {
    toast.add({ title: 'Erro ao abrir a assinatura', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    assinaturaAbrindo.value = null
  }
}

// ---- Remover técnico (deixar sem atribuição) ----
async function removerTecnico() {
  const ok = await confirm({
    title: 'Remover técnico',
    message:
      'O chamado voltará para "Aberto" e ficará sem técnico. As linhas '
      + 'automáticas (chamada fixa, mão de obra, deslocamento) serão descartadas. '
      + 'Continuar?',
    confirmLabel: 'Remover técnico',
    confirmColor: 'warning',
    icon: 'i-lucide-user-minus'
  })
  if (!ok) return
  await acao(
    () => $api(`/chamados/${id}/desatribuir`, { method: 'POST' }),
    'Técnico removido'
  )
}

// ---- Editar detalhes ----
const editarOpen = ref(false)
const podeEditar = can('atendimentos.editar')
const prioridadeItems = [
  { label: 'Baixa', value: 'baixa' },
  { label: 'Média', value: 'media' },
  { label: 'Alta', value: 'alta' },
  { label: 'Urgente', value: 'urgente' }
]
const editForm = reactive({
  titulo: '',
  descricao: '',
  chamadoInterno: '',
  chamadoExterno: '',
  prioridade: 'media' as Chamado['prioridade'],
  agendadoPara: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  complemento: '',
  cityCode: null as number | null,
  pontoReferencia: '',
  localId: null as number | null,
  latitude: '',
  longitude: '',
  contatoLocalNome: '',
  contatoLocalTelefone: '',
  codigoCheckin: '',
  codigoCheckout: '',
  servicoId: 0
})
// Locais do cliente (para vincular/copiar endereço na edição e exibir o nome).
const locais = ref<ClientLocal[]>([])
const locaisCarregados = ref(false)
async function carregarLocais() {
  const clientId = chamado.value?.clientId
  if (!clientId || locaisCarregados.value || !can('clientes.ver')) return
  try {
    locais.value = await $api<ClientLocal[]>(`/clients/${clientId}/locais`)
  } catch {
    locais.value = []
  } finally {
    locaisCarregados.value = true
  }
}
carregarLocais()
const localAtual = computed(() =>
  locais.value.find(l => l.id === chamado.value?.localId) ?? null
)
const localItems = computed(() => [
  { label: 'Sem local vinculado', value: 0 },
  ...locais.value.map(l => ({
    label: l.ativo ? l.nome : `${l.nome} (inativo)`,
    value: l.id
  }))
])
// Copia endereço, cidade, coordenadas e contato do local escolhido.
function copiarDoLocal() {
  const l = locais.value.find(x => x.id === editForm.localId)
  if (!l) return
  editForm.cep = l.cep ?? ''
  editForm.logradouro = l.logradouro ?? ''
  editForm.numero = l.numero ?? ''
  editForm.bairro = l.bairro ?? ''
  editForm.complemento = l.complemento ?? ''
  editForm.pontoReferencia = l.pontoReferencia ?? ''
  editForm.latitude = l.latitude != null ? String(l.latitude) : ''
  editForm.longitude = l.longitude != null ? String(l.longitude) : ''
  editForm.contatoLocalNome = l.contatoNome ?? ''
  editForm.contatoLocalTelefone = l.contatoTelefone ?? ''
  if (podeGerenciar) {
    editForm.codigoCheckin = l.codigoCheckin ?? ''
    editForm.codigoCheckout = l.codigoCheckout ?? ''
  }
  if (l.cityCode) {
    editForm.cityCode = l.cityCode
    editCityLabel.value = l.city ? `${l.city.nome} / ${l.city.uf}` : ''
    editCityKey.value++
  }
}
const editErro = ref('')
const editCityLabel = ref('')
const editCityKey = ref(0)
const cepLoading = ref(false)
const salvandoEdicao = ref(false)
const salvandoLinha = ref(false)

// ISO -> "YYYY-MM-DDTHH:mm" no fuso local, para o input datetime-local.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

function abrirEditar() {
  const c = chamado.value
  if (!c) return
  editForm.titulo = c.titulo
  editForm.descricao = c.descricao ?? ''
  editForm.chamadoInterno = c.chamadoInterno ?? ''
  editForm.chamadoExterno = c.chamadoExterno ?? ''
  editForm.prioridade = c.prioridade
  editForm.agendadoPara = toDatetimeLocal(c.agendadoPara)
  editForm.cep = c.cep ?? ''
  editForm.logradouro = c.logradouro ?? ''
  editForm.numero = c.numero ?? ''
  editForm.bairro = c.bairro ?? ''
  editForm.complemento = c.complemento ?? ''
  editForm.cityCode = c.cityCode
  editForm.pontoReferencia = c.pontoReferencia ?? ''
  editForm.localId = c.localId
  editForm.latitude = c.latitude != null ? String(c.latitude) : ''
  editForm.longitude = c.longitude != null ? String(c.longitude) : ''
  editForm.contatoLocalNome = c.contatoLocalNome ?? ''
  editForm.contatoLocalTelefone = c.contatoLocalTelefone ?? ''
  editForm.codigoCheckin = c.codigoCheckin ?? ''
  editForm.codigoCheckout = c.codigoCheckout ?? ''
  editForm.servicoId = c.servicoId ?? 0
  editCityLabel.value = c.city ? `${c.city.nome} / ${c.city.uf}` : ''
  editCityKey.value++
  editErro.value = ''
  carregarLocais()
  editarOpen.value = true
}

async function buscarCepEdicao() {
  const cep = editForm.cep.replace(/\D/g, '')
  if (cep.length !== 8) return
  cepLoading.value = true
  try {
    const data = await $fetch<{
      logradouro?: string
      bairro?: string
      localidade?: string
      uf?: string
      ibge?: string
      erro?: boolean
    }>(`https://viacep.com.br/ws/${cep}/json/`)
    if (!data.erro) {
      editForm.logradouro = data.logradouro || editForm.logradouro
      editForm.bairro = data.bairro || editForm.bairro
      if (data.ibge) {
        editForm.cityCode = Number(data.ibge)
        editCityLabel.value
          = data.localidade && data.uf ? `${data.localidade} / ${data.uf}` : ''
        editCityKey.value++
      }
    }
  } catch {
    // CEP não encontrado — preenchimento manual.
  } finally {
    cepLoading.value = false
  }
}

async function salvarEdicao() {
  if (editForm.titulo.trim().length < 2) {
    editErro.value = 'Informe um título com ao menos 2 caracteres'
    return
  }
  salvandoEdicao.value = true
  try {
    const payload: UpdateChamadoPayload = {
      titulo: editForm.titulo.trim(),
      descricao: editForm.descricao.trim(),
      chamadoInterno: editForm.chamadoInterno.trim(),
      chamadoExterno: editForm.chamadoExterno.trim(),
      prioridade: editForm.prioridade,
      cep: editForm.cep.trim(),
      logradouro: editForm.logradouro.trim(),
      numero: editForm.numero.trim(),
      bairro: editForm.bairro.trim(),
      complemento: editForm.complemento.trim(),
      pontoReferencia: editForm.pontoReferencia.trim(),
      contatoLocalNome: editForm.contatoLocalNome.trim(),
      contatoLocalTelefone: editForm.contatoLocalTelefone.trim(),
      localId: editForm.localId || null,
      servicoId: editForm.servicoId || null,
      latitude: editForm.latitude === '' ? null : Number(editForm.latitude),
      longitude: editForm.longitude === '' ? null : Number(editForm.longitude),
      agendadoPara: editForm.agendadoPara
        ? new Date(editForm.agendadoPara).toISOString()
        : null
    }
    if (
      (payload.latitude != null && Number.isNaN(payload.latitude))
      || (payload.longitude != null && Number.isNaN(payload.longitude))
    ) {
      editErro.value = ''
      toast.add({ title: 'Coordenadas inválidas', icon: 'i-lucide-alert-circle', color: 'error' })
      return
    }
    // Códigos de check-in/out: só o gestor vê/edita.
    if (podeGerenciar) {
      payload.codigoCheckin = editForm.codigoCheckin.trim()
      payload.codigoCheckout = editForm.codigoCheckout.trim()
    }
    // Cidade é opcional; só enviamos quando definida.
    if (editForm.cityCode) payload.cityCode = editForm.cityCode
    await acao(
      () => $api(`/chamados/${id}`, { method: 'PATCH', body: payload }),
      'Chamado atualizado'
    )
    editarOpen.value = false
  } finally {
    salvandoEdicao.value = false
  }
}

// ---- Finalizar (técnico) ----
const finalizarOpen = ref(false)
const finalizando = ref(false)
const finForm = reactive({
  horasTrabalhadas: 0,
  kmDeslocamento: 0,
  observacao: '',
  codigo: '',
  assinadoPor: '',
  assinadoDoc: '',
  avaliacaoNota: 0,
  avaliacaoComentario: ''
})
const previa = ref<PreviaFinalizacao | null>(null)
const signaturePad = ref<{
  clear: () => void
  isEmpty: () => boolean
  toBlob: () => Promise<Blob | null>
} | null>(null)
const assinaturaDesenhada = ref(false)
const finErro = ref('')

async function abrirFinalizar() {
  finForm.horasTrabalhadas = 0
  finForm.kmDeslocamento = 0
  finForm.observacao = ''
  finForm.codigo = ''
  finForm.assinadoPor = ''
  finForm.assinadoDoc = ''
  finForm.avaliacaoNota = 0
  finForm.avaliacaoComentario = ''
  finErro.value = ''
  assinaturaDesenhada.value = false
  previa.value = null
  finalizarOpen.value = true
  try {
    previa.value = await $api<PreviaFinalizacao>(`/chamados/${id}/previa-finalizacao`)
    if (previa.value?.horasSugeridas != null) {
      finForm.horasTrabalhadas = Number(previa.value.horasSugeridas)
    }
  } catch {
    previa.value = null
  }
}

async function confirmarFinalizar() {
  finErro.value = ''
  const temAssinatura = assinaturaDesenhada.value && !signaturePad.value?.isEmpty()
  if (temAssinatura && finForm.assinadoPor.trim().length < 2) {
    finErro.value = 'Informe quem assinou (mín. 2 caracteres)'
    return
  }
  if (assinaturaObrigatoria.value && !temAssinatura) {
    finErro.value = 'A assinatura do cliente é obrigatória'
    return
  }
  if (chamado.value?.exigeCodigoCheckout && !finForm.codigo.trim()) {
    finErro.value = 'Informe o código de check-out fornecido pelo cliente'
    return
  }
  finalizando.value = true
  try {
    const geo = await capturarGeo()
    const payload: FinalizarPayload = {
      horasTrabalhadas: Number(finForm.horasTrabalhadas) || 0,
      kmDeslocamento: Number(finForm.kmDeslocamento) || 0,
      observacao: finForm.observacao.trim() || undefined,
      geo,
      codigo: finForm.codigo.trim() || undefined
    }
    if (temAssinatura) {
      const blob = await signaturePad.value!.toBlob()
      if (!blob) throw new Error('Não foi possível gerar a imagem da assinatura')
      const { signedUrl, path } = await $api<{ signedUrl: string, path: string, token: string }>(
        `/chamados/${id}/assinatura/upload-url`,
        { method: 'POST' }
      )
      const put = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: blob
      })
      if (!put.ok) throw new Error(`upload da assinatura falhou (${put.status})`)
      payload.assinatura = {
        storagePath: path,
        assinadoPor: finForm.assinadoPor.trim(),
        assinadoDoc: finForm.assinadoDoc.trim() || undefined
      }
    }
    if (avaliacaoHabilitada.value && finForm.avaliacaoNota > 0) {
      payload.avaliacao = {
        nota: finForm.avaliacaoNota,
        comentario: finForm.avaliacaoComentario.trim() || undefined
      }
    }
    const res = await $api<Chamado>(`/chamados/${id}/finalizar`, { method: 'POST', body: payload })
    toast.add({
      title: 'Chamado finalizado',
      description: res.avisoSemRat ? 'Atenção: finalizado sem RAT anexada.' : undefined,
      icon: 'i-lucide-check',
      color: 'success'
    })
    finalizarOpen.value = false
    await reloadAll()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string | string[] }, message?: string }
    const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
    toast.add({ title: msg ?? err?.message ?? 'Erro ao finalizar', icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    finalizando.value = false
  }
}

// ---- Pausar / retomar ----
const pausarOpen = ref(false)
const pausarMotivo = ref('')
const pausarMotivoId = ref(0)
const motivosPausa = ref<Motivo[]>([])
async function abrirPausar() {
  pausarMotivo.value = ''
  pausarMotivoId.value = 0
  pausarOpen.value = true
  motivosPausa.value = await carregarMotivos('pausa')
}
async function confirmarPausar() {
  await acao(
    () =>
      $api(`/chamados/${id}/pausar`, {
        method: 'POST',
        body: { motivo: pausarMotivo.value.trim() || undefined, motivoId: pausarMotivoId.value || undefined }
      }),
    'Atendimento pausado'
  )
  pausarOpen.value = false
}
const retomar = () =>
  acao(() => $api(`/chamados/${id}/retomar`, { method: 'POST' }), 'Atendimento retomado')

// ---- Check-in com código (quando o cliente exige) ----
const checkinOpen = ref(false)
const checkinCodigo = ref('')
const checkinEnviando = ref(false)

// ---- Motivo (cancelar/reabrir/recusar) ----
const motivoOpen = ref(false)
type MotivoAcao = 'cancelar' | 'reabrir' | 'recusar' | 'cancelar_visita'
const motivoAcao = ref<MotivoAcao>('cancelar')
const motivoTexto = ref('')
const MOTIVO_SUCESSO: Record<MotivoAcao, string> = {
  cancelar: 'Chamado cancelado',
  reabrir: 'Chamado reaberto',
  recusar: 'Solicitação recusada',
  cancelar_visita: 'Visita cancelada'
}
const MOTIVO_META: Record<
  typeof motivoAcao.value,
  { title: string, label: string, color: 'error' | 'warning' }
> = {
  cancelar: { title: 'Cancelar chamado', label: 'Cancelar chamado', color: 'error' },
  reabrir: { title: 'Reabrir chamado', label: 'Reabrir', color: 'warning' },
  recusar: { title: 'Recusar solicitação', label: 'Recusar', color: 'error' },
  cancelar_visita: { title: 'Cancelar visita atual', label: 'Cancelar visita', color: 'error' }
}
const MOTIVO_TIPO: Record<MotivoAcao, MotivoTipo> = {
  cancelar: 'cancelamento',
  cancelar_visita: 'cancelamento',
  reabrir: 'reabertura',
  recusar: 'recusa'
}
const motivoId = ref(0)
const motivosCatalogo = ref<Motivo[]>([])
async function abrirMotivo(tipo: MotivoAcao) {
  motivoAcao.value = tipo
  motivoTexto.value = ''
  motivoId.value = 0
  motivoOpen.value = true
  motivosCatalogo.value = await carregarMotivos(MOTIVO_TIPO[tipo])
}
async function confirmarMotivo() {
  if (motivoTexto.value.trim().length < 3) return
  const url = motivoAcao.value === 'cancelar_visita'
    ? `/chamados/${id}/visitas/${visitaAtual.value?.id}/cancelar`
    : `/chamados/${id}/${motivoAcao.value}`
  await acao(
    () =>
      $api(url, {
        method: 'POST',
        body: { motivo: motivoTexto.value.trim(), motivoId: motivoId.value || undefined }
      }),
    MOTIVO_SUCESSO[motivoAcao.value]
  )
  motivoOpen.value = false
}

// ---- Ações simples do técnico ----
const aceitar = () =>
  acao(
    () => $api(`/chamados/${id}/aceitar`, { method: 'POST' }),
    'Solicitação aceita!'
  )
const marcarACaminho = async () => {
  const geo = await capturarGeo()
  await acao(
    () => $api(`/chamados/${id}/a-caminho`, { method: 'POST', body: { geo } }),
    'A caminho'
  )
}
async function executarChegada(codigo?: string) {
  checkinEnviando.value = true
  try {
    const geo = await capturarGeo()
    await acao(
      () =>
        $api(`/chamados/${id}/chegada`, {
          method: 'POST',
          body: { geo, codigo: codigo?.trim() || undefined }
        }),
      'Chegada confirmada'
    )
    checkinOpen.value = false
  } finally {
    checkinEnviando.value = false
  }
}
// Se o cliente exige código de check-in, pedimos antes de enviar.
function confirmarChegada() {
  if (chamado.value?.exigeCodigoCheckin) {
    checkinCodigo.value = ''
    checkinOpen.value = true
    return
  }
  return executarChegada()
}
const fechar = () =>
  acao(
    () => $api(`/chamados/${id}/fechar`, { method: 'POST' }),
    'Chamado fechado'
  )

// ---- Financeiro: line items ----
const lineOpen = ref(false)
const lineForm = reactive({
  natureza: 'custo' as 'custo' | 'receita',
  tipo: 'servico' as
  | 'material'
  | 'deslocamento'
  | 'extra'
  | 'ajuste',
  descricao: '',
  quantidade: 1,
  valorUnitario: undefined as number | undefined
})
const naturezaItems = [
  { label: 'Custo (paga técnico)', value: 'custo' },
  { label: 'Receita (cobra cliente)', value: 'receita' }
]
const tipoItems = [
  { label: 'Serviço', value: 'servico' },
  { label: 'Deslocamento', value: 'deslocamento' },
  { label: 'Material', value: 'material' },
  { label: 'Extra', value: 'extra' },
  { label: 'Ajuste', value: 'ajuste' }
]
async function addLine() {
  if (!lineForm.valorUnitario) return
  salvandoLinha.value = true
  await acao(
    () =>
      $api(`/chamados/${id}/line-items`, {
        method: 'POST',
        body: {
          natureza: lineForm.natureza,
          tipo: lineForm.tipo,
          descricao: lineForm.descricao || undefined,
          quantidade: lineForm.quantidade,
          valorUnitario: lineForm.valorUnitario
        }
      }),
    'Linha adicionada'
  )
  lineOpen.value = false
  lineForm.descricao = ''
  lineForm.valorUnitario = undefined
  lineForm.quantidade = 1
  salvandoLinha.value = false
}
const removeLine = (itemId: number) =>
  acao(
    () => $api(`/chamados/${id}/line-items/${itemId}`, { method: 'DELETE' }),
    'Linha removida'
  )

// ---- Ajuste de horas/km de visita finalizada (gestor) ----
const execOpen = ref(false)
const salvandoExec = ref(false)
const execForm = reactive({
  visitaId: null as number | null,
  visitaNumero: 0,
  horasTrabalhadas: 0,
  kmDeslocamento: 0
})
const execValido = computed(
  () =>
    execForm.horasTrabalhadas >= 0
    && execForm.horasTrabalhadas <= 1000
    && execForm.kmDeslocamento >= 0
    && execForm.kmDeslocamento <= 100000
)
/** Linha automática de execução (mão de obra/km) de uma visita finalizada: pode ser ajustada. */
function visitaAjustavel(i: ChamadoLineItem): ChamadoVisita | null {
  if (i.origem !== 'auto_snapshot' || !i.visitaId) return null
  if (i.tipo !== 'deslocamento' && i.tipo !== 'servico') return null
  const v = visitas.value.find(x => x.id === i.visitaId)
  return v && v.status === 'finalizado' ? v : null
}
function abrirAjusteExecucao(v: ChamadoVisita) {
  execForm.visitaId = v.id
  execForm.visitaNumero = v.numero
  execForm.horasTrabalhadas = Number(v.horasTrabalhadas ?? 0)
  execForm.kmDeslocamento = Number(v.kmDeslocamento ?? 0)
  execOpen.value = true
}
async function salvarAjusteExecucao() {
  if (!execForm.visitaId || !execValido.value) return
  salvandoExec.value = true
  try {
    await acao(
      () =>
        $api(`/chamados/${id}/visitas/${execForm.visitaId}/execucao`, {
          method: 'PATCH',
          body: {
            horasTrabalhadas: execForm.horasTrabalhadas,
            kmDeslocamento: execForm.kmDeslocamento
          }
        }),
      'Horas/km ajustados'
    )
    execOpen.value = false
  } finally {
    salvandoExec.value = false
  }
}

// ---- Pagamento ----
const aprovar = () =>
  acao(
    () =>
      $api(`/chamados/${id}/pagamento`, {
        method: 'PATCH',
        body: { paymentStatus: 'aprovado' }
      }),
    'Pagamento aprovado'
  )
const marcarPago = () =>
  acao(
    () =>
      $api(`/chamados/${id}/pagamento`, {
        method: 'PATCH',
        body: { paymentStatus: 'pago' }
      }),
    'Marcado como pago'
  )

// ---- Imposto da nota fiscal ----
const impostoOpen = ref(false)
const salvandoImposto = ref(false)
const aliquotaVigente = ref<string | null>(null)
const impostoForm = reactive({
  emiteNota: true,
  modo: 'vigente' as 'vigente' | 'manual',
  aliquota: undefined as number | undefined
})
const aliquotaValida = computed(
  () =>
    impostoForm.aliquota !== undefined
    && impostoForm.aliquota >= 0
    && impostoForm.aliquota <= 100
)
const modoAliquotaItems = computed(() => [
  {
    label: `Alíquota vigente da empresa${aliquotaVigente.value !== null ? ` (${pct(aliquotaVigente.value)})` : ''}`,
    value: 'vigente'
  },
  { label: 'Alíquota própria deste chamado', value: 'manual' }
])
// Origem da alíquota exibida no card.
const origemAliquota = computed(() => {
  const c = chamado.value
  if (!c) return ''
  if (c.valoresCongeladosEm) return 'congelada no fechamento'
  return c.aliquotaImpostoManual != null ? 'própria do chamado' : 'vigente da empresa'
})

async function abrirImposto() {
  const c = chamado.value
  if (!c) return
  impostoForm.emiteNota = c.emiteNota ?? false
  impostoForm.modo = c.aliquotaImpostoManual != null ? 'manual' : 'vigente'
  impostoForm.aliquota = Number(c.aliquotaImpostoManual ?? c.aliquotaImposto ?? 0)
  impostoOpen.value = true
  try {
    const cfg = await $api<FinanceiroConfig>('/financeiro/config')
    aliquotaVigente.value = cfg.aliquotaImposto
  } catch {
    aliquotaVigente.value = null
  }
}

async function salvarImposto() {
  const manual = impostoForm.emiteNota && impostoForm.modo === 'manual'
  if (manual && !aliquotaValida.value) return
  salvandoImposto.value = true
  try {
    await acao(
      () =>
        $api(`/chamados/${id}/imposto`, {
          method: 'PATCH',
          // Sem nota, a alíquota própria é mantida (vale se voltar a emitir).
          body: impostoForm.emiteNota
            ? { emiteNota: true, aliquotaImpostoManual: manual ? impostoForm.aliquota : null }
            : { emiteNota: false }
        }),
      'Imposto atualizado'
    )
    impostoOpen.value = false
  } finally {
    salvandoImposto.value = false
  }
}

const custoItems = computed(() =>
  (chamado.value?.lineItems ?? []).filter(i => i.natureza === 'custo')
)
const receitaItems = computed(() =>
  (chamado.value?.lineItems ?? []).filter(i => i.natureza === 'receita')
)

// Endereço do atendimento formatado em linhas (só as partes preenchidas).
const enderecoLinhas = computed<string[]>(() => {
  const c = chamado.value
  if (!c) return []
  const linhas: string[] = []
  const l1 = [c.logradouro, c.numero].filter(Boolean).join(', ')
  if (l1) linhas.push(c.complemento ? `${l1} — ${c.complemento}` : l1)
  else if (c.complemento) linhas.push(c.complemento)
  const l2 = [c.bairro, c.city ? `${c.city.nome}/${c.city.uf}` : null]
    .filter(Boolean)
    .join(' • ')
  if (l2) linhas.push(l2)
  if (c.cep) linhas.push(`CEP ${c.cep}`)
  return linhas
})

// ---- RAT: upload (dono ou gestor) + download via signed URL ----
const podeAnexarRat = computed(
  () =>
    chamado.value
    && !['fechado', 'cancelado'].includes(chamado.value.status)
    && (isDono.value || podeGerenciar)
)
const ratInput = ref<HTMLInputElement | null>(null)
const uploadingRat = ref(false)

function escolherArquivoRat() {
  ratInput.value?.click()
}

async function onRatSelecionado(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingRat.value = true
  try {
    // 1) pede a URL assinada de upload à nossa API
    const { signedUrl, path } = await $api<{
      signedUrl: string
      path: string
      token: string
    }>(`/chamados/${id}/rat/upload-url`, {
      method: 'POST',
      body: { fileName: file.name }
    })
    // 2) sobe o arquivo direto ao Storage
    const put = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    })
    if (!put.ok) throw new Error(`upload falhou (${put.status})`)
    // 3) confirma os metadados
    await $api(`/chamados/${id}/rat`, {
      method: 'POST',
      body: {
        storagePath: path,
        fileName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size
      }
    })
    toast.add({
      title: 'RAT anexada',
      icon: 'i-lucide-check',
      color: 'success'
    })
    await refreshRats()
    await refreshEventos()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }, message?: string }
    toast.add({
      title: err?.data?.message ?? err?.message ?? 'Erro ao anexar RAT',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  } finally {
    uploadingRat.value = false
    if (ratInput.value) ratInput.value.value = ''
  }
}

async function abrirRat(ratId: number) {
  try {
    const { signedUrl } = await $api<{ signedUrl: string }>(
      `/chamados/${id}/rat/${ratId}/download-url`
    )
    window.open(signedUrl, '_blank', 'noopener')
  } catch {
    toast.add({
      title: 'Erro ao abrir a RAT',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  }
}

const { confirm } = useConfirm()
const removendoRat = ref<number | null>(null)
async function removerRat(ratId: number, fileName: string) {
  const ok = await confirm({
    title: 'Remover RAT',
    message: `Remover a RAT "${fileName}"? Esta ação não pode ser desfeita.`,
    confirmLabel: 'Remover',
    confirmColor: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  removendoRat.value = ratId
  try {
    await $api(`/chamados/${id}/rat/${ratId}`, { method: 'DELETE' })
    toast.add({
      title: 'RAT removida',
      icon: 'i-lucide-check',
      color: 'success'
    })
    await refreshRats()
    await refreshEventos()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    toast.add({
      title: err?.data?.message ?? 'Erro ao remover a RAT',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    })
  } finally {
    removendoRat.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="chamado-detalhe">
    <template #header>
      <UDashboardNavbar :title="chamado ? `${chamado.codigo}` : 'Chamado'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/chamados"
            aria-label="Voltar"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="error" class="py-16 text-center text-sm text-muted">
        Chamado não encontrado.
      </div>

      <div v-else-if="chamado" class="space-y-4">
        <!-- Cabeçalho -->
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1
              class="text-xl font-semibold text-highlighted flex items-center gap-2"
            >
              {{ chamado.titulo }}
              <UBadge
                :color="statusMeta(chamado.status).color"
                variant="subtle"
              >
                {{ statusMeta(chamado.status).label }}
              </UBadge>
              <UBadge
                :color="prioridadeMeta(chamado.prioridade).color"
                variant="subtle"
                size="sm"
              >
                {{ prioridadeMeta(chamado.prioridade).label }}
              </UBadge>
              <UBadge
                v-if="chamado.arquivadoEm"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-archive"
              >
                Arquivado
              </UBadge>
            </h1>
            <div v-if="slaPrimeira || slaConclusao" class="flex flex-wrap items-center gap-2 mt-1">
              <UTooltip v-if="slaPrimeira" :text="`Prazo da 1ª visita: ${slaPrimeira.detalhe}`">
                <UBadge
                  :color="slaPrimeira.color"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-timer"
                >
                  1ª visita: {{ slaPrimeira.label }}
                </UBadge>
              </UTooltip>
              <UTooltip v-if="slaConclusao" :text="`Prazo de conclusão: ${slaConclusao.detalhe}`">
                <UBadge
                  :color="slaConclusao.color"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-flag"
                >
                  Conclusão: {{ slaConclusao.label }}
                </UBadge>
              </UTooltip>
            </div>
            <p class="text-muted text-sm mt-1">
              {{ chamado.client?.nome }}
              <span v-if="chamado.city">
                • {{ chamado.city.nome }}/{{ chamado.city.uf }}</span>
            </p>
          </div>

          <!-- Ações contextuais -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Editar detalhes -->
            <UButton
              v-if="
                podeEditar
                  && !['fechado', 'cancelado'].includes(chamado.status)
              "
              label="Editar detalhes"
              icon="i-lucide-pencil"
              size="sm"
              color="neutral"
              variant="subtle"
              @click="abrirEditar"
            />
            <!-- Técnico (dono) ou gestor em nome dele: aceite da solicitação -->
            <UButton
              v-if="podeAgirComoTecnico && chamado.status === 'solicitado'"
              label="Aceitar"
              icon="i-lucide-check"
              size="sm"
              color="success"
              @click="aceitar"
            />
            <UButton
              v-if="podeAgirComoTecnico && chamado.status === 'solicitado'"
              label="Recusar"
              icon="i-lucide-x"
              size="sm"
              color="error"
              variant="subtle"
              @click="abrirMotivo('recusar')"
            />
            <!-- Técnico (dono) ou gestor em nome dele -->
            <UButton
              v-if="podeAgirComoTecnico && chamado.status === 'atribuido'"
              label="A caminho"
              icon="i-lucide-navigation"
              size="sm"
              color="info"
              variant="subtle"
              @click="marcarACaminho"
            />
            <UButton
              v-if="
                podeAgirComoTecnico && ['atribuido', 'a_caminho'].includes(chamado.status)
              "
              label="Confirmar chegada"
              icon="i-lucide-map-pin"
              size="sm"
              color="info"
              variant="subtle"
              @click="confirmarChegada"
            />
            <UButton
              v-if="podeAgirComoTecnico && chamado.status === 'em_atendimento'"
              label="Pausar"
              icon="i-lucide-pause"
              size="sm"
              color="warning"
              variant="subtle"
              @click="abrirPausar"
            />
            <UButton
              v-if="podeAgirComoTecnico && chamado.status === 'pausado'"
              label="Retomar"
              icon="i-lucide-play"
              size="sm"
              color="info"
              @click="retomar"
            />
            <UButton
              v-if="podeAgirComoTecnico && chamado.status === 'em_atendimento'"
              label="Finalizar"
              icon="i-lucide-check-check"
              size="sm"
              color="primary"
              @click="abrirFinalizar"
            />
            <!-- Gestor -->
            <UButton
              v-if="
                podeGerenciar
                  && ['aberto', 'solicitado', 'atribuido', 'a_caminho', 'em_atendimento', 'pausado'].includes(
                    chamado.status
                  )
                  && !podeNovaVisita
              "
              :label="chamado.tecnicoUserId ? 'Reatribuir' : 'Atribuir técnico'"
              icon="i-lucide-user-plus"
              size="sm"
              variant="subtle"
              @click="abrirAtribuir"
            />
            <UButton
              v-if="podeNovaVisita"
              label="Nova visita"
              icon="i-lucide-calendar-plus"
              size="sm"
              variant="subtle"
              @click="abrirNovaVisita"
            />
            <UButton
              v-if="
                podeGerenciar
                  && chamado.tecnicoUserId
                  && ['solicitado', 'atribuido', 'a_caminho', 'em_atendimento', 'pausado'].includes(
                    chamado.status
                  )
              "
              label="Remover técnico"
              icon="i-lucide-user-minus"
              size="sm"
              color="warning"
              variant="subtle"
              @click="removerTecnico"
            />
            <UButton
              v-if="podeGerenciar && visitaAtualAtiva"
              label="Cancelar visita"
              icon="i-lucide-calendar-x"
              size="sm"
              color="error"
              variant="subtle"
              @click="abrirMotivo('cancelar_visita')"
            />
            <UButton
              v-if="podeGerenciar && chamado.status === 'finalizado'"
              label="Confirmar e fechar"
              icon="i-lucide-lock"
              size="sm"
              color="success"
              @click="fechar"
            />
            <UButton
              v-if="
                podeGerenciar
                  && ['finalizado', 'fechado', 'cancelado'].includes(chamado.status)
              "
              label="Reabrir"
              icon="i-lucide-rotate-ccw"
              size="sm"
              color="warning"
              variant="subtle"
              @click="abrirMotivo('reabrir')"
            />
            <UButton
              v-if="
                podeGerenciar
                  && !['fechado', 'cancelado'].includes(chamado.status)
              "
              label="Cancelar"
              icon="i-lucide-x-circle"
              size="sm"
              color="error"
              variant="subtle"
              @click="abrirMotivo('cancelar')"
            />
            <UButton
              v-if="podeArquivar && !chamado.arquivadoEm"
              label="Arquivar"
              icon="i-lucide-archive"
              size="sm"
              color="neutral"
              variant="subtle"
              @click="arquivar"
            />
            <UButton
              v-if="podeArquivar && chamado.arquivadoEm"
              label="Desarquivar"
              icon="i-lucide-archive-restore"
              size="sm"
              color="neutral"
              variant="subtle"
              @click="desarquivar"
            />
          </div>
        </div>

        <div
          v-if="chamado.avisoSemRat && chamado.status === 'finalizado'"
          class="text-xs text-warning flex items-center gap-1"
        >
          <UIcon name="i-lucide-triangle-alert" class="size-4" /> Finalizado sem
          RAT anexada.
        </div>

        <div class="grid grid-cols-1 gap-4" :class="{ 'lg:grid-cols-3': podeVerHistorico }">
          <!-- Coluna principal -->
          <div class="lg:col-span-2 space-y-4">
            <!-- Detalhes -->
            <UPageCard title="Detalhes" variant="subtle">
              <dl class="space-y-3 text-sm">
                <div v-if="chamado.descricao">
                  <dt class="text-muted text-xs mb-0.5">
                    Descrição
                  </dt>
                  <dd class="text-highlighted whitespace-pre-line">
                    {{ chamado.descricao }}
                  </dd>
                </div>
                <div v-if="chamado.servico" class="flex justify-between gap-3">
                  <dt class="text-muted">
                    Serviço
                  </dt>
                  <dd class="text-highlighted text-right">
                    {{ chamado.servico.nome }}
                  </dd>
                </div>
                <div v-if="chamado.prazoPrimeiraVisita" class="flex justify-between gap-3">
                  <dt class="text-muted">
                    Prazo 1ª visita (SLA)
                  </dt>
                  <dd class="text-right" :class="chamado.slaPrimeiraVisitaEstourado ? 'text-error' : 'text-highlighted'">
                    {{ fmtDataHora(chamado.prazoPrimeiraVisita) }}
                    <span v-if="chamado.primeiraVisitaEm" class="text-muted text-xs">• chegou {{ fmtDataHora(chamado.primeiraVisitaEm) }}</span>
                  </dd>
                </div>
                <div v-if="chamado.prazoConclusao" class="flex justify-between gap-3">
                  <dt class="text-muted">
                    Prazo conclusão (SLA)
                  </dt>
                  <dd class="text-right" :class="chamado.slaConclusaoEstourado ? 'text-error' : 'text-highlighted'">
                    {{ fmtDataHora(chamado.prazoConclusao) }}
                  </dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-muted">
                    Chamado Interno
                  </dt>
                  <dd class="text-highlighted text-right">
                    {{ chamado.chamadoInterno ?? "—" }}
                  </dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-muted">
                    Chamado Externo
                  </dt>
                  <dd class="text-highlighted text-right">
                    {{ chamado.chamadoExterno ?? "—" }}
                  </dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-muted">
                    Técnico
                  </dt>
                  <dd class="text-highlighted text-right">
                    {{ chamado.tecnicoNome ?? "— não atribuído" }}
                  </dd>
                </div>
                <div
                  v-if="chamado.agendadoPara"
                  class="flex justify-between gap-3"
                >
                  <dt class="text-muted">
                    Agendado para
                  </dt>
                  <dd class="text-highlighted text-right">
                    {{ new Date(chamado.agendadoPara).toLocaleString("pt-BR") }}
                  </dd>
                </div>
                <div
                  v-if="chamado.horasTrabalhadas"
                  class="flex justify-between gap-3"
                >
                  <dt class="text-muted">
                    Execução
                  </dt>
                  <dd class="text-highlighted text-right">
                    {{ chamado.horasTrabalhadas }}h •
                    {{ chamado.kmDeslocamento }} km
                  </dd>
                </div>
                <div v-if="enderecoLinhas.length || chamado.localId" class="pt-1">
                  <dt class="text-muted text-xs mb-0.5">
                    Endereço do atendimento
                  </dt>
                  <dd class="text-highlighted">
                    <p v-if="chamado.localId" class="font-medium">
                      <UIcon name="i-lucide-building" class="size-3.5 inline-block align-text-bottom" />
                      {{ localAtual?.nome ?? `Local #${chamado.localId}` }}
                    </p>
                    <p v-for="(linha, i) in enderecoLinhas" :key="i">
                      {{ linha }}
                    </p>
                    <p
                      v-if="chamado.pontoReferencia"
                      class="text-muted text-xs mt-0.5"
                    >
                      Referência: {{ chamado.pontoReferencia }}
                    </p>
                    <p v-if="chamado.latitude != null && chamado.longitude != null" class="text-xs mt-0.5">
                      <a
                        :href="mapsUrl(chamado.latitude, chamado.longitude)"
                        target="_blank"
                        rel="noopener"
                        class="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <UIcon name="i-lucide-map" class="size-3.5" />
                        {{ chamado.latitude.toFixed(5) }}, {{ chamado.longitude.toFixed(5) }} — abrir no Google Maps
                      </a>
                    </p>
                  </dd>
                </div>
                <div
                  v-if="chamado.contatoLocalNome || chamado.contatoLocalTelefone"
                  class="flex justify-between gap-3"
                >
                  <dt class="text-muted">
                    Contato no local
                  </dt>
                  <dd class="text-highlighted text-right">
                    {{ chamado.contatoLocalNome ?? '—' }}
                    <a
                      v-if="chamado.contatoLocalTelefone"
                      :href="`tel:${chamado.contatoLocalTelefone.replace(/\D/g, '')}`"
                      class="text-primary hover:underline ml-1"
                    >{{ chamado.contatoLocalTelefone }}</a>
                  </dd>
                </div>
                <div
                  v-else-if="chamado.client?.telefone"
                  class="flex justify-between gap-3"
                >
                  <dt class="text-muted">
                    Telefone do cliente
                  </dt>
                  <dd class="text-highlighted text-right">
                    <a
                      :href="`tel:${chamado.client.telefone.replace(/\D/g, '')}`"
                      class="text-primary hover:underline"
                    >{{ chamado.client.telefone }}</a>
                  </dd>
                </div>
                <div
                  v-if="podeGerenciar && (chamado.codigoCheckin || chamado.codigoCheckout)"
                  class="flex justify-between gap-3"
                >
                  <dt class="text-muted">
                    Códigos (check-in / check-out)
                  </dt>
                  <dd class="text-highlighted text-right font-mono text-xs">
                    {{ chamado.codigoCheckin || '—' }} / {{ chamado.codigoCheckout || '—' }}
                  </dd>
                </div>
                <div
                  v-else-if="!podeGerenciar && (chamado.exigeCodigoCheckin || chamado.exigeCodigoCheckout)"
                  class="flex justify-between gap-3"
                >
                  <dt class="text-muted">
                    Códigos exigidos
                  </dt>
                  <dd class="text-highlighted text-right text-xs">
                    <span v-if="chamado.exigeCodigoCheckin">check-in</span>
                    <span v-if="chamado.exigeCodigoCheckin && chamado.exigeCodigoCheckout"> • </span>
                    <span v-if="chamado.exigeCodigoCheckout">check-out</span>
                    <span class="text-muted"> (o cliente informa no local)</span>
                  </dd>
                </div>
              </dl>
            </UPageCard>

            <!-- Visitas -->
            <UPageCard
              variant="subtle"
              :ui="{ container: 'p-0 sm:p-0', header: 'w-full' }"
            >
              <template #header>
                <div class="w-full flex items-center justify-between gap-3 p-4 border-b border-default">
                  <div>
                    <p class="text-highlighted font-medium">
                      Visitas
                    </p>
                    <p class="text-muted text-xs">
                      {{ visitas.length }} {{ visitas.length === 1 ? 'visita' : 'visitas' }}
                    </p>
                  </div>
                  <UButton
                    v-if="podeNovaVisita"
                    label="Nova visita"
                    icon="i-lucide-calendar-plus"
                    size="xs"
                    variant="subtle"
                    @click="abrirNovaVisita"
                  />
                </div>
              </template>
              <div class="p-4">
                <p v-if="!visitas.length" class="text-sm text-muted">
                  Nenhuma visita ainda — atribua um técnico para criar a primeira.
                </p>
                <ol v-else class="space-y-3">
                  <li
                    v-for="v in visitas"
                    :key="v.id"
                    class="rounded-lg border p-3 text-sm space-y-2"
                    :class="v.id === chamado.visitaAtualId ? 'border-primary/50 bg-primary/5' : 'border-default'"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-highlighted">Visita {{ v.numero }}</span>
                        <UBadge :color="visitaStatusMeta(v.status).color" variant="subtle" size="sm">
                          {{ visitaStatusMeta(v.status).label }}
                        </UBadge>
                        <UBadge
                          v-if="v.id === chamado.visitaAtualId"
                          color="primary"
                          variant="outline"
                          size="sm"
                        >
                          atual
                        </UBadge>
                      </div>
                      <span class="text-xs text-muted">
                        {{ v.tecnicoNome ?? 'sem técnico' }}
                      </span>
                    </div>
                    <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <dt class="text-muted">
                          Agendamento
                        </dt>
                        <dd class="text-highlighted">
                          {{ fmtDataHora(v.agendadoPara) }}
                          <span v-if="v.duracaoPrevistaMin" class="text-muted">({{ fmtDuracao(v.duracaoPrevistaMin) }})</span>
                        </dd>
                      </div>
                      <div v-if="v.chegadaEm">
                        <dt class="text-muted">
                          Chegada
                        </dt>
                        <dd class="text-highlighted">
                          {{ fmtDataHora(v.chegadaEm) }}
                          <span v-if="v.chegadaDistanciaM != null" class="text-muted">
                            • a {{ fmtDistancia(v.chegadaDistanciaM) }} do local
                          </span>
                        </dd>
                      </div>
                      <div v-if="v.finalizadoEm">
                        <dt class="text-muted">
                          Finalizada
                        </dt>
                        <dd class="text-highlighted">
                          {{ fmtDataHora(v.finalizadoEm) }}
                        </dd>
                      </div>
                      <div v-if="v.horasTrabalhadas || v.kmDeslocamento">
                        <dt class="text-muted">
                          Execução
                        </dt>
                        <dd class="text-highlighted">
                          {{ v.horasTrabalhadas ?? '0.00' }}h • {{ v.kmDeslocamento ?? '0.00' }} km
                        </dd>
                      </div>
                      <div v-if="v.pausas.length">
                        <dt class="text-muted">
                          Pausas
                        </dt>
                        <dd class="text-highlighted">
                          {{ v.pausas.length }}
                          <span class="text-muted">
                            ({{ v.pausas.filter(p => !p.fimEm).length ? 'em pausa' : 'todas retomadas' }})
                          </span>
                        </dd>
                      </div>
                      <div v-if="v.canceladoEm">
                        <dt class="text-muted">
                          Cancelada
                        </dt>
                        <dd class="text-highlighted">
                          {{ fmtDataHora(v.canceladoEm) }}
                          <span v-if="v.motivoCancelamento" class="text-muted">— {{ v.motivoCancelamento }}</span>
                        </dd>
                      </div>
                      <div v-if="v.avaliacaoNota">
                        <dt class="text-muted">
                          Avaliação
                        </dt>
                        <dd class="flex items-center gap-0.5">
                          <UIcon
                            v-for="n in 5"
                            :key="n"
                            name="i-lucide-star"
                            class="size-3.5"
                            :class="n <= (v.avaliacaoNota ?? 0) ? 'text-warning' : 'text-muted/40'"
                          />
                          <span v-if="v.avaliacaoComentario" class="text-muted ml-1 truncate">{{ v.avaliacaoComentario }}</span>
                        </dd>
                      </div>
                    </dl>
                    <p v-if="v.observacao" class="text-xs text-muted whitespace-pre-line">
                      {{ v.observacao }}
                    </p>
                    <div v-if="v.assinado" class="flex items-center gap-2 text-xs">
                      <UButton
                        label="Ver assinatura"
                        icon="i-lucide-pen-line"
                        size="xs"
                        variant="subtle"
                        :loading="assinaturaAbrindo === v.id"
                        @click="abrirAssinatura(v.id)"
                      />
                      <span class="text-muted">
                        {{ v.assinadoPor }}<span v-if="v.assinadoDoc"> • {{ v.assinadoDoc }}</span>
                        • {{ fmtDataHora(v.assinadoEm) }}
                      </span>
                    </div>
                  </li>
                </ol>
              </div>
            </UPageCard>

            <!-- Financeiro -->
            <UPageCard
              v-if="podeFin || chamado.lineItems"
              variant="subtle"
              :ui="{ container: 'p-0 sm:p-0', header: 'w-full' }"
            >
              <template #header>
                <div
                  class="w-full flex items-center justify-between gap-3 p-4 border-b border-default"
                >
                  <div>
                    <p class="text-highlighted font-medium">
                      Financeiro
                    </p>
                    <p class="text-muted text-xs">
                      <template v-if="isDono">
                        Seu ganho: {{ brl(chamado.custoTecnicoTotal) }}
                      </template>
                      <template v-else>
                        Custo (técnico): {{ brl(chamado.custoTecnicoTotal) }}
                      </template>
                      <template v-if="podeFin">
                        • Receita: {{ brl(chamado.valorClienteTotal) }} •
                        Imposto: {{ brl(chamado.impostoTotal) }} •
                        Lucro: {{ brl(chamado.margem) }}
                      </template>
                    </p>
                  </div>
                  <UButton
                    v-if="podeFinGerenciar && !chamado.valoresCongeladosEm"
                    label="Adicionar linha"
                    icon="i-lucide-plus"
                    size="xs"
                    variant="subtle"
                    @click="lineOpen = true"
                  />
                </div>
              </template>

              <div class="p-4 space-y-3">
                <!-- Destaque do total para o técnico dono -->
                <div
                  v-if="isDono"
                  class="flex items-center gap-3 rounded-lg bg-success/10 border border-success/20 px-4 py-3"
                >
                  <UIcon name="i-lucide-circle-dollar-sign" class="size-5 text-success shrink-0" />
                  <div>
                    <p class="text-xs text-success/80 font-medium uppercase">
                      Total a receber neste chamado
                    </p>
                    <p class="text-xl font-bold text-success">
                      {{ brl(chamado.custoTecnicoTotal) }}
                    </p>
                  </div>
                </div>

                <div>
                  <p class="text-xs font-semibold uppercase text-muted mb-1">
                    <template v-if="isDono">
                      Composição dos ganhos
                    </template>
                    <template v-else>
                      Custos (técnico)
                    </template>
                  </p>
                  <ul class="divide-y divide-default">
                    <li
                      v-for="i in custoItems"
                      :key="i.id"
                      class="flex items-center justify-between gap-2 py-1.5 text-sm"
                    >
                      <span class="text-highlighted truncate">
                        {{ i.descricao || i.tipo }}
                        <span class="text-muted text-xs">({{ i.quantidade }} ×
                          {{ brl(i.valorUnitario) }})</span>
                      </span>
                      <span class="flex items-center gap-2 shrink-0">
                        <span class="text-highlighted">{{
                          brl(i.valorTotal)
                        }}</span>
                        <UButton
                          v-if="
                            podeFinGerenciar
                              && !chamado.valoresCongeladosEm
                              && visitaAjustavel(i)
                          "
                          icon="i-lucide-pencil"
                          color="neutral"
                          variant="ghost"
                          size="xs"
                          title="Ajustar horas/km desta visita"
                          @click="abrirAjusteExecucao(visitaAjustavel(i)!)"
                        />
                        <UButton
                          v-if="
                            podeFinGerenciar
                              && i.origem === 'manual'
                              && !chamado.valoresCongeladosEm
                          "
                          icon="i-lucide-trash-2"
                          color="error"
                          variant="ghost"
                          size="xs"
                          @click="removeLine(i.id)"
                        />
                      </span>
                    </li>
                    <li
                      v-if="!custoItems.length"
                      class="py-1.5 text-xs text-muted"
                    >
                      Sem custos lançados.
                    </li>
                  </ul>
                </div>

                <div v-if="podeFin">
                  <p class="text-xs font-semibold uppercase text-muted mb-1">
                    Receita (cliente)
                  </p>
                  <ul class="divide-y divide-default">
                    <li
                      v-for="i in receitaItems"
                      :key="i.id"
                      class="flex items-center justify-between gap-2 py-1.5 text-sm"
                    >
                      <span class="text-highlighted truncate">{{
                        i.descricao || i.tipo
                      }}</span>
                      <span class="flex items-center gap-2 shrink-0">
                        <span class="text-highlighted">{{
                          brl(i.valorTotal)
                        }}</span>
                        <UButton
                          v-if="
                            podeFinGerenciar && !chamado.valoresCongeladosEm
                          "
                          icon="i-lucide-trash-2"
                          color="error"
                          variant="ghost"
                          size="xs"
                          @click="removeLine(i.id)"
                        />
                      </span>
                    </li>
                    <li
                      v-if="!receitaItems.length"
                      class="py-1.5 text-xs text-muted"
                    >
                      Sem receita lançada.
                    </li>
                  </ul>
                </div>

                <!-- Imposto da nota fiscal + resultado do chamado -->
                <div v-if="podeFin" class="border-t border-default pt-3 space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-semibold uppercase text-muted">
                      Imposto (nota fiscal)
                    </p>
                    <UButton
                      v-if="podeFinGerenciar && !chamado.valoresCongeladosEm"
                      label="Ajustar"
                      icon="i-lucide-percent"
                      size="xs"
                      variant="ghost"
                      @click="abrirImposto"
                    />
                  </div>
                  <p class="text-sm">
                    <template v-if="chamado.emiteNota">
                      <span class="text-highlighted">Com nota • alíquota {{ pct(chamado.aliquotaImposto) }}</span>
                      <span class="text-muted text-xs"> ({{ origemAliquota }})</span>
                    </template>
                    <span v-else class="text-muted">Sem nota fiscal — sem imposto.</span>
                  </p>
                  <dl class="text-sm space-y-1">
                    <div class="flex justify-between gap-2">
                      <dt class="text-muted">
                        Receita bruta
                      </dt>
                      <dd class="text-highlighted">
                        {{ brl(chamado.valorClienteTotal) }}
                      </dd>
                    </div>
                    <div class="flex justify-between gap-2">
                      <dt class="text-muted">
                        − Imposto
                      </dt>
                      <dd class="text-error">
                        {{ brl(chamado.impostoTotal) }}
                      </dd>
                    </div>
                    <div class="flex justify-between gap-2">
                      <dt class="text-muted">
                        − Custo do técnico
                      </dt>
                      <dd class="text-error">
                        {{ brl(chamado.custoTecnicoTotal) }}
                      </dd>
                    </div>
                    <div class="flex justify-between gap-2 border-t border-default pt-1 font-semibold">
                      <dt class="text-highlighted">
                        = Lucro
                      </dt>
                      <dd class="text-primary">
                        {{ brl(chamado.margem) }}
                      </dd>
                    </div>
                  </dl>
                </div>

                <!-- Pagamento -->
                <div
                  v-if="chamado.status === 'fechado'"
                  class="flex items-center justify-between border-t border-default pt-3"
                >
                  <div class="text-sm">
                    <span class="text-muted">Pagamento:</span>
                    <UBadge
                      :color="paymentMeta(chamado.paymentStatus).color"
                      variant="subtle"
                      class="ml-1"
                    >
                      {{ paymentMeta(chamado.paymentStatus).label }}
                    </UBadge>
                    <span
                      v-if="chamado.paymentPeriodo"
                      class="text-muted text-xs ml-2"
                    >competência {{ chamado.paymentPeriodo }}</span>
                  </div>
                  <div v-if="podeFinGerenciar" class="flex gap-2">
                    <UButton
                      v-if="chamado.paymentStatus === 'pendente'"
                      label="Aprovar"
                      size="xs"
                      color="info"
                      variant="subtle"
                      @click="aprovar"
                    />
                    <UButton
                      v-if="chamado.paymentStatus === 'aprovado'"
                      label="Marcar pago"
                      size="xs"
                      color="success"
                      variant="subtle"
                      @click="marcarPago"
                    />
                  </div>
                </div>

                <!-- Comprovantes do repasse (gestor financeiro ou o próprio técnico) -->
                <ChamadosComprovantesPagamento
                  v-if="chamado.status === 'fechado' && podeVerComprovantes"
                  :chamado-id="chamado.id"
                  :pode-gerenciar="podeFinGerenciar"
                  class="border-t border-default pt-3"
                  @changed="refreshEventos"
                />
              </div>
            </UPageCard>

            <!-- Comentários -->
            <UPageCard
              variant="subtle"
              :ui="{ container: 'p-0 sm:p-0', header: 'w-full' }"
            >
              <template #header>
                <div class="w-full flex items-center justify-between gap-3 p-4 border-b border-default">
                  <p class="text-highlighted font-medium">
                    Comentários
                  </p>
                  <span class="text-xs text-muted">{{ comentarios.length }}</span>
                </div>
              </template>
              <div class="p-4 space-y-3">
                <ul v-if="comentarios.length" class="space-y-3">
                  <li
                    v-for="c in comentarios"
                    :key="c.id"
                    class="flex gap-3 text-sm"
                  >
                    <UAvatar :alt="c.autorNome" size="sm" class="shrink-0" />
                    <div class="min-w-0 flex-1">
                      <p class="flex items-center justify-between gap-2">
                        <span class="text-highlighted font-medium truncate">{{ c.autorNome }}</span>
                        <span class="flex items-center gap-1 shrink-0">
                          <span class="text-dimmed text-xs">{{ fmtDataHora(c.createdAt) }}</span>
                          <UButton
                            v-if="podeGerenciar || c.autorUserId === user?.id"
                            icon="i-lucide-trash-2"
                            color="error"
                            variant="ghost"
                            size="xs"
                            aria-label="Excluir comentário"
                            :loading="removendoComentario === c.id"
                            @click="removerComentario(c)"
                          />
                        </span>
                      </p>
                      <p class="text-highlighted whitespace-pre-line break-words">
                        {{ c.texto }}
                      </p>
                    </div>
                  </li>
                </ul>
                <p v-else class="text-sm text-muted">
                  Nenhum comentário ainda.
                </p>
                <div v-if="podeAgirComoTecnico || podeGerenciar" class="flex flex-col gap-2 border-t border-default pt-3">
                  <UTextarea
                    v-model="comentarioTexto"
                    class="w-full"
                    :rows="2"
                    placeholder="Escreva um comentário para a equipe…"
                    @keydown.ctrl.enter.prevent="enviarComentario"
                  />
                  <div class="flex justify-end">
                    <UButton
                      label="Enviar"
                      icon="i-lucide-send"
                      size="sm"
                      :disabled="!comentarioTexto.trim()"
                      :loading="enviandoComentario"
                      @click="enviarComentario"
                    />
                  </div>
                </div>
              </div>
            </UPageCard>

            <!-- RAT -->
            <UPageCard
              variant="subtle"
              :ui="{ container: 'p-0 sm:p-0', header: 'w-full' }"
            >
              <template #header>
                <div
                  class="w-full flex items-center justify-between gap-3 p-4 border-b border-default"
                >
                  <p class="text-highlighted font-medium">
                    RAT (Relatório de Atendimento)
                  </p>
                  <UButton
                    v-if="podeAnexarRat"
                    label="Anexar"
                    icon="i-lucide-upload"
                    size="xs"
                    variant="subtle"
                    :loading="uploadingRat"
                    @click="escolherArquivoRat"
                  />
                </div>
              </template>
              <div class="p-4">
                <input
                  ref="ratInput"
                  type="file"
                  class="hidden"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  @change="onRatSelecionado"
                >
                <ul v-if="rats?.length" class="divide-y divide-default text-sm">
                  <li
                    v-for="r in rats"
                    :key="r.id"
                    class="flex items-center justify-between gap-2 py-2"
                  >
                    <button
                      type="button"
                      class="text-highlighted truncate flex items-center gap-2 hover:text-primary text-left min-w-0"
                      @click="abrirRat(r.id)"
                    >
                      <UIcon
                        name="i-lucide-file-text"
                        class="size-4 shrink-0"
                      />
                      <span class="truncate">{{ r.fileName }}</span>
                    </button>
                    <span class="flex items-center gap-2 shrink-0">
                      <span class="text-muted text-xs">{{
                        new Date(r.createdAt).toLocaleDateString("pt-BR")
                      }}</span>
                      <UButton
                        v-if="podeAnexarRat"
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="xs"
                        :loading="removendoRat === r.id"
                        aria-label="Remover RAT"
                        @click="removerRat(r.id, r.fileName)"
                      />
                    </span>
                  </li>
                </ul>
                <p v-else class="text-sm text-muted">
                  Nenhuma RAT anexada.
                </p>
              </div>
            </UPageCard>
          </div>

          <!-- Timeline -->
          <div v-if="podeVerHistorico">
            <UPageCard title="Histórico" variant="subtle">
              <ol class="space-y-3">
                <li
                  v-for="e in eventos ?? []"
                  :key="e.id"
                  class="flex gap-3 text-sm"
                >
                  <UIcon
                    name="i-lucide-circle-dot"
                    class="size-4 mt-0.5 text-muted shrink-0"
                  />
                  <div class="min-w-0">
                    <p class="text-highlighted">
                      {{ eventLabel(e.tipo) }}
                    </p>
                    <p v-if="e.nota" class="text-muted text-xs">
                      {{ e.nota }}
                    </p>
                    <p class="text-dimmed text-xs">
                      {{ e.atorEmail }} •
                      {{ new Date(e.createdAt).toLocaleString("pt-BR") }}
                    </p>
                  </div>
                </li>
                <li v-if="!eventos?.length" class="text-xs text-muted">
                  Sem eventos.
                </li>
              </ol>
            </UPageCard>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Modal: atribuir -->
  <UModal v-model:open="atribuirOpen" title="Atribuir técnico">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Técnico">
          <TechniciansTecnicoSelect v-model="tecnicoSel" :tecnicos="tecnicosAtivos" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Data e hora" help="Opcional — agendamento da visita">
            <UInput v-model="atribAgendadoPara" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField label="Duração prevista (min)" help="Opcional — 5 a 1440">
            <UInput
              v-model.number="atribDuracao"
              type="number"
              min="5"
              max="1440"
              step="5"
              class="w-full"
              placeholder="Ex.: 120"
            />
          </UFormField>
        </div>
        <UFormField
          label="Chamada fixa (custo)"
          help="Opcional — valor fixo do atendimento"
        >
          <CurrencyInput v-model="chamadaFixa" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="atribuirOpen = false"
          />
          <UButton
            label="Atribuir"
            :disabled="!tecnicoSel"
            @click="confirmarAtribuir"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: editar detalhes -->
  <UModal v-model:open="editarOpen" title="Editar detalhes do chamado">
    <template #body>
      <div class="space-y-4">
        <UFormField v-if="servicos.length" label="Serviço do catálogo">
          <USelect v-model="editForm.servicoId" :items="servicoItems" class="w-full" />
        </UFormField>
        <UFormField label="Título" required :error="editErro || undefined">
          <UInput v-model="editForm.titulo" class="w-full" />
        </UFormField>

        <UFormField label="Descrição">
          <UTextarea v-model="editForm.descricao" class="w-full" :rows="4" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Chamado interno">
            <UInput
              v-model="editForm.chamadoInterno"
              class="w-full"
              placeholder="Ex.: 12345"
            />
          </UFormField>
          <UFormField label="Chamado externo">
            <UInput
              v-model="editForm.chamadoExterno"
              class="w-full"
              placeholder="Ex.: INC-00987"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Prioridade">
            <USelect
              v-model="editForm.prioridade"
              :items="prioridadeItems"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Agendado para" help="Deixe vazio para remover">
            <UInput
              v-model="editForm.agendadoPara"
              type="datetime-local"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="border-t border-default pt-4 space-y-4">
          <p class="text-xs font-semibold uppercase text-muted">
            Endereço do atendimento
          </p>

          <UFormField
            v-if="locais.length"
            label="Local do cliente"
            help="Vincule a um local cadastrado e copie o endereço, se desejar"
          >
            <div class="flex gap-2">
              <USelect
                :model-value="editForm.localId ?? 0"
                :items="localItems"
                class="flex-1"
                @update:model-value="(v: number) => { editForm.localId = v || null }"
              />
              <UButton
                label="Copiar endereço"
                icon="i-lucide-copy"
                color="neutral"
                variant="subtle"
                :disabled="!editForm.localId"
                @click="copiarDoLocal"
              />
            </div>
          </UFormField>

          <UFormField label="CEP" help="Preencha para buscar automaticamente">
            <div class="flex gap-2">
              <UInput
                v-model="editForm.cep"
                class="flex-1"
                placeholder="00000-000"
                inputmode="numeric"
                @keydown.enter.prevent="buscarCepEdicao"
              />
              <UButton
                label="Buscar"
                icon="i-lucide-search"
                color="neutral"
                variant="subtle"
                :loading="cepLoading"
                @click="buscarCepEdicao"
              />
            </div>
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField label="Logradouro" class="sm:col-span-2">
              <UInput
                v-model="editForm.logradouro"
                class="w-full"
                placeholder="Rua, avenida…"
              />
            </UFormField>
            <UFormField label="Número">
              <UInput v-model="editForm.numero" class="w-full" />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Bairro">
              <UInput v-model="editForm.bairro" class="w-full" />
            </UFormField>
            <UFormField label="Complemento">
              <UInput
                v-model="editForm.complemento"
                class="w-full"
                placeholder="Bloco, sala, apto…"
              />
            </UFormField>
          </div>

          <UFormField label="Cidade do atendimento">
            <CityAutocomplete
              :key="editCityKey"
              v-model="editForm.cityCode"
              :initial-label="editCityLabel"
              placeholder="Buscar cidade"
            />
          </UFormField>

          <UFormField label="Ponto de referência">
            <UInput
              v-model="editForm.pontoReferencia"
              class="w-full"
              placeholder="Ex.: próximo ao mercado central"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Latitude" help="Opcional — usada no check-in">
              <UInput
                v-model="editForm.latitude"
                type="number"
                step="any"
                class="w-full"
                placeholder="-3.119"
              />
            </UFormField>
            <UFormField label="Longitude">
              <UInput
                v-model="editForm.longitude"
                type="number"
                step="any"
                class="w-full"
                placeholder="-60.021"
              />
            </UFormField>
          </div>
        </div>

        <div class="border-t border-default pt-4 space-y-4">
          <p class="text-xs font-semibold uppercase text-muted">
            Contato no local
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Nome">
              <UInput v-model="editForm.contatoLocalNome" class="w-full" placeholder="Quem recebe o técnico" />
            </UFormField>
            <UFormField label="Telefone">
              <UInput v-model="editForm.contatoLocalTelefone" class="w-full" placeholder="(00) 00000-0000" />
            </UFormField>
          </div>
          <div v-if="podeGerenciar" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Código de check-in" help="Vazio = não exige">
              <UInput v-model="editForm.codigoCheckin" class="w-full" />
            </UFormField>
            <UFormField label="Código de check-out" help="Vazio = não exige">
              <UInput v-model="editForm.codigoCheckout" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="editarOpen = false"
          />
          <UButton
            label="Salvar"
            icon="i-lucide-check"
            :loading="salvandoEdicao"
            @click="salvarEdicao"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: finalizar -->
  <UModal v-model:open="finalizarOpen" title="Finalizar atendimento" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <div class="space-y-4">
        <div
          v-if="previa?.horasSugeridas != null"
          class="rounded-lg bg-info/10 border border-info/20 px-3 py-2 text-xs text-highlighted"
        >
          <UIcon name="i-lucide-timer" class="size-4 inline-block align-text-bottom text-info" />
          Tempo líquido desde a chegada ({{ fmtDataHora(previa.chegadaEm) }}):
          <strong>{{ previa.horasSugeridas }}h</strong>
          <span v-if="previa.pausas.length" class="text-muted">
            — {{ previa.pausas.length }} {{ previa.pausas.length === 1 ? 'pausa descontada' : 'pausas descontadas' }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Horas trabalhadas">
            <UInput
              v-model.number="finForm.horasTrabalhadas"
              type="number"
              min="0"
              step="0.25"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Km de deslocamento">
            <UInput
              v-model.number="finForm.kmDeslocamento"
              type="number"
              min="0"
              step="1"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Observação">
          <UTextarea v-model="finForm.observacao" class="w-full" :rows="2" />
        </UFormField>

        <UFormField
          v-if="chamado?.exigeCodigoCheckout"
          label="Código de check-out"
          required
          help="Peça ao cliente o código de saída"
        >
          <UInput v-model="finForm.codigo" class="w-full" autocomplete="off" />
        </UFormField>

        <!-- Assinatura do cliente -->
        <div class="border-t border-default pt-4 space-y-3">
          <p class="text-xs font-semibold uppercase text-muted">
            Assinatura do cliente
            <span v-if="assinaturaObrigatoria" class="text-error">*</span>
            <span v-else class="normal-case font-normal">(opcional)</span>
          </p>
          <SignaturePad
            ref="signaturePad"
            :height="160"
            :disabled="finalizando"
            @change="(empty: boolean) => { assinaturaDesenhada = !empty }"
          />
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Assinado por" :required="assinaturaDesenhada">
              <UInput v-model="finForm.assinadoPor" class="w-full" placeholder="Nome de quem assinou" />
            </UFormField>
            <UFormField label="Documento" help="Opcional — CPF/RG">
              <UInput v-model="finForm.assinadoDoc" class="w-full" />
            </UFormField>
          </div>
        </div>

        <!-- Avaliação -->
        <div v-if="avaliacaoHabilitada" class="border-t border-default pt-4 space-y-3">
          <p class="text-xs font-semibold uppercase text-muted">
            Avaliação do cliente <span class="normal-case font-normal">(opcional)</span>
          </p>
          <div class="flex items-center gap-1">
            <UButton
              v-for="n in 5"
              :key="n"
              icon="i-lucide-star"
              variant="ghost"
              size="lg"
              :color="n <= finForm.avaliacaoNota ? 'warning' : 'neutral'"
              :aria-label="`${n} ${n === 1 ? 'estrela' : 'estrelas'}`"
              :class="n <= finForm.avaliacaoNota ? '' : 'opacity-50'"
              @click="finForm.avaliacaoNota = finForm.avaliacaoNota === n ? 0 : n"
            />
            <span v-if="finForm.avaliacaoNota" class="text-xs text-muted ml-2">{{ finForm.avaliacaoNota }}/5</span>
          </div>
          <UTextarea
            v-model="finForm.avaliacaoComentario"
            class="w-full"
            :rows="2"
            placeholder="Comentário do cliente (opcional)"
          />
        </div>

        <p v-if="finErro" class="text-xs text-error">
          {{ finErro }}
        </p>

        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            :disabled="finalizando"
            @click="finalizarOpen = false"
          />
          <UButton
            label="Finalizar"
            color="primary"
            :loading="finalizando"
            @click="confirmarFinalizar"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: nova visita (retorno) -->
  <UModal v-model:open="novaVisitaOpen" title="Nova visita">
    <template #body>
      <div class="space-y-4">
        <p class="text-xs text-muted">
          Cria a visita {{ visitas.length + 1 }} deste chamado com um técnico (pode ser o mesmo).
          As horas e o deslocamento da nova visita serão somados ao custo do chamado.
        </p>
        <UFormField label="Técnico" required>
          <TechniciansTecnicoSelect v-model="novaVisitaForm.tecnicoUserId" :tecnicos="tecnicosAtivos" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Data e hora" help="Opcional">
            <UInput v-model="novaVisitaForm.agendadoPara" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField label="Duração prevista (min)" help="Opcional — 5 a 1440">
            <UInput
              v-model.number="novaVisitaForm.duracaoPrevistaMin"
              type="number"
              min="5"
              max="1440"
              step="5"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Chamada fixa (custo)" help="Opcional — valor fixo desta visita">
          <CurrencyInput v-model="novaVisitaForm.chamadaFixa" class="w-full" />
        </UFormField>
        <UFormField label="Observação">
          <UTextarea
            v-model="novaVisitaForm.observacao"
            class="w-full"
            :rows="2"
            placeholder="Ex.: retorno para troca de peça"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="novaVisitaOpen = false"
          />
          <UButton
            label="Criar visita"
            icon="i-lucide-calendar-plus"
            :disabled="!novaVisitaForm.tecnicoUserId"
            :loading="salvandoVisita"
            @click="confirmarNovaVisita"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: pausar -->
  <UModal v-model:open="pausarOpen" title="Pausar atendimento">
    <template #body>
      <div class="space-y-4">
        <p class="text-xs text-muted">
          O tempo em pausa é descontado das horas sugeridas na finalização.
        </p>
        <UFormField v-if="motivosPausa.length" label="Classificação" help="Opcional">
          <USelect v-model="pausarMotivoId" :items="motivoItems(motivosPausa)" class="w-full" />
        </UFormField>
        <UFormField label="Motivo" help="Opcional">
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
            color="warning"
            icon="i-lucide-pause"
            @click="confirmarPausar"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: código de check-in -->
  <UModal v-model:open="checkinOpen" title="Confirmar chegada">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Este cliente exige um código de check-in. Peça o código ao contato no local.
        </p>
        <UFormField label="Código de check-in" required>
          <UInput
            v-model="checkinCodigo"
            class="w-full"
            autocomplete="off"
            autofocus
            @keydown.enter.prevent="checkinCodigo.trim() && executarChegada(checkinCodigo)"
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
            icon="i-lucide-map-pin"
            color="info"
            :disabled="!checkinCodigo.trim()"
            :loading="checkinEnviando"
            @click="executarChegada(checkinCodigo)"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: motivo (cancelar/reabrir/recusar) -->
  <UModal
    v-model:open="motivoOpen"
    :title="MOTIVO_META[motivoAcao].title"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField v-if="motivosCatalogo.length" label="Classificação" help="Opcional">
          <USelect v-model="motivoId" :items="motivoItems(motivosCatalogo)" class="w-full" />
        </UFormField>
        <UFormField label="Motivo" required>
          <UTextarea
            v-model="motivoTexto"
            class="w-full"
            :rows="3"
            placeholder="Descreva o motivo"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Voltar"
            color="neutral"
            variant="subtle"
            @click="motivoOpen = false"
          />
          <UButton
            :label="MOTIVO_META[motivoAcao].label"
            :color="MOTIVO_META[motivoAcao].color"
            :disabled="motivoTexto.trim().length < 3"
            @click="confirmarMotivo"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: imposto da nota fiscal -->
  <UModal v-model:open="impostoOpen" title="Imposto da nota fiscal">
    <template #body>
      <div class="space-y-4">
        <USwitch
          v-model="impostoForm.emiteNota"
          label="Emite nota fiscal"
          description="Sem nota, não há imposto sobre a receita deste chamado."
        />
        <template v-if="impostoForm.emiteNota">
          <URadioGroup v-model="impostoForm.modo" :items="modoAliquotaItems" />
          <UFormField
            v-if="impostoForm.modo === 'manual'"
            label="Alíquota (%)"
            :error="aliquotaValida ? undefined : 'Informe um valor entre 0 e 100'"
          >
            <UInput
              v-model.number="impostoForm.aliquota"
              type="number"
              min="0"
              max="100"
              step="0.01"
              class="w-full"
            />
          </UFormField>
        </template>
        <p class="text-xs text-muted">
          O imposto é calculado sobre a receita bruta e congelado quando o
          chamado é fechado.
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="impostoOpen = false"
          />
          <UButton
            label="Salvar"
            :disabled="impostoForm.emiteNota && impostoForm.modo === 'manual' && !aliquotaValida"
            :loading="salvandoImposto"
            @click="salvarImposto"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: ajuste de horas/km de visita finalizada -->
  <UModal
    v-model:open="execOpen"
    :title="`Ajustar execução — Visita ${execForm.visitaNumero}`"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Horas trabalhadas">
            <UInput
              v-model.number="execForm.horasTrabalhadas"
              type="number"
              min="0"
              max="1000"
              step="0.25"
              class="w-full"
            />
          </UFormField>
          <UFormField label="KM de deslocamento">
            <UInput
              v-model.number="execForm.kmDeslocamento"
              type="number"
              min="0"
              max="100000"
              step="0.1"
              class="w-full"
            />
          </UFormField>
        </div>
        <p class="text-xs text-muted">
          As linhas automáticas de mão de obra e deslocamento desta visita são
          recalculadas com as tarifas congeladas do técnico. Zerar o KM remove
          a linha de deslocamento.
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="execOpen = false"
          />
          <UButton
            label="Salvar"
            :disabled="!execValido"
            :loading="salvandoExec"
            @click="salvarAjusteExecucao"
          />
        </div>
      </div>
    </template>
  </UModal>

  <!-- Modal: line item -->
  <UModal v-model:open="lineOpen" title="Adicionar linha financeira">
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Natureza">
            <USelect
              v-model="lineForm.natureza"
              :items="naturezaItems"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Tipo">
            <USelect
              v-model="lineForm.tipo"
              :items="tipoItems"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Descrição">
          <UInput v-model="lineForm.descricao" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Quantidade">
            <UInput
              v-model.number="lineForm.quantidade"
              type="number"
              min="0"
              step="0.5"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Valor unitário (R$)">
            <CurrencyInput v-model="lineForm.valorUnitario" class="w-full" />
          </UFormField>
        </div>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="lineOpen = false"
          />
          <UButton
            label="Adicionar"
            :disabled="!lineForm.valorUnitario"
            :loading="salvandoLinha"
            @click="addLine"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
