<script setup lang="ts">
import type { Client, ClientLocal, ClientLocalPayload } from '~/types'

definePageMeta({ permission: 'clientes.ver' })

const route = useRoute()
const { $api } = useNuxtApp()
const { can } = usePermissions()
const toast = useToast()
const { confirm } = useConfirm()

const canEdit = can('clientes.editar')
const canDelete = can('clientes.excluir')
const podeGerenciarChamados = can('atendimentos.gerenciar')

const clientId = Number(route.params.id)

const { data: cliente, error, refresh } = await useAsyncData(
  `client-${route.params.id}`,
  () => $api<Client>(`/clients/${route.params.id}`)
)

// Clientes finais deste cliente (quando ele é contratante de alguém).
const { data: clientesFinais } = await useAsyncData(
  `client-${route.params.id}-finais`,
  () => $api<Client[]>('/clients', { params: { contratanteId: clientId } }),
  { default: () => [] as Client[] }
)

const locais = computed<ClientLocal[]>(() => cliente.value?.locais ?? [])

function documento(c: Client) {
  if (c.tipo === 'pj') return c.cnpj ?? '—'
  return c.cpf ?? '—'
}

function enderecoCompleto(c: Client | ClientLocal) {
  const cidadeUf = c.city ? `${c.city.nome} • ${c.city.uf}` : null
  const linha1 = [c.logradouro, c.numero].filter(Boolean).join(', ')
  const linha2 = [c.bairro, cidadeUf].filter(Boolean).join(' • ')
  return [linha1, c.complemento, linha2, c.cep ? `CEP ${c.cep}` : null]
    .filter(Boolean)
    .join('\n')
}

const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`

function mensagemErro(e: unknown, fallback: string) {
  const err = e as { data?: { message?: string | string[] } }
  const msg = Array.isArray(err?.data?.message) ? err.data.message[0] : err?.data?.message
  return msg ?? fallback
}

// ---- Exclusão do cliente ----
const deleteOpen = ref(false)
const deleting = ref(false)

async function confirmRemove() {
  deleting.value = true
  try {
    await $api(`/clients/${route.params.id}`, { method: 'DELETE' })
    toast.add({ title: 'Cliente excluído', icon: 'i-lucide-check', color: 'success' })
    await navigateTo('/clientes')
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao excluir cliente'), icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    deleting.value = false
  }
}

// ---- Locais: CRUD em modal ----
const localOpen = ref(false)
const localSalvando = ref(false)
const localEditandoId = ref<number | null>(null)
const localErro = ref('')
const localCityLabel = ref('')
const localKey = ref(0)

const localForm = reactive({
  nome: '',
  ativo: true,
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  pontoReferencia: '',
  cityCode: null as number | null,
  latitude: '',
  longitude: '',
  contatoNome: '',
  contatoTelefone: '',
  codigoCheckin: '',
  codigoCheckout: '',
  observacoes: ''
})

function abrirLocal(l?: ClientLocal) {
  localEditandoId.value = l?.id ?? null
  localForm.nome = l?.nome ?? ''
  localForm.ativo = l?.ativo ?? true
  localForm.cep = l?.cep ?? ''
  localForm.logradouro = l?.logradouro ?? ''
  localForm.numero = l?.numero ?? ''
  localForm.complemento = l?.complemento ?? ''
  localForm.bairro = l?.bairro ?? ''
  localForm.pontoReferencia = l?.pontoReferencia ?? ''
  localForm.cityCode = l?.cityCode ?? cliente.value?.cityCode ?? null
  localForm.latitude = l?.latitude != null ? String(l.latitude) : ''
  localForm.longitude = l?.longitude != null ? String(l.longitude) : ''
  localForm.contatoNome = l?.contatoNome ?? ''
  localForm.contatoTelefone = l?.contatoTelefone ?? ''
  localForm.codigoCheckin = l?.codigoCheckin ?? ''
  localForm.codigoCheckout = l?.codigoCheckout ?? ''
  localForm.observacoes = l?.observacoes ?? ''
  const city = l?.city ?? (l ? null : cliente.value?.city ?? null)
  localCityLabel.value = city ? `${city.nome} / ${city.uf}` : ''
  localKey.value++
  localErro.value = ''
  localOpen.value = true
}

// Copia o endereço principal do cliente para o formulário do local.
function copiarEnderecoCliente() {
  const c = cliente.value
  if (!c) return
  localForm.cep = c.cep ?? ''
  localForm.logradouro = c.logradouro ?? ''
  localForm.numero = c.numero ?? ''
  localForm.complemento = c.complemento ?? ''
  localForm.bairro = c.bairro ?? ''
  localForm.cityCode = c.cityCode
  localCityLabel.value = c.city ? `${c.city.nome} / ${c.city.uf}` : ''
  localKey.value++
}

async function salvarLocal() {
  if (localForm.nome.trim().length < 2) {
    localErro.value = 'Informe um nome com ao menos 2 caracteres'
    return
  }
  const lat = localForm.latitude === '' ? null : Number(localForm.latitude)
  const lng = localForm.longitude === '' ? null : Number(localForm.longitude)
  if ((lat != null && Number.isNaN(lat)) || (lng != null && Number.isNaN(lng))) {
    localErro.value = 'Coordenadas inválidas'
    return
  }
  localErro.value = ''
  localSalvando.value = true
  try {
    // String vazia limpa o campo (a API aceita strings; null só nas coords/cidade).
    const payload: ClientLocalPayload = {
      nome: localForm.nome.trim(),
      ativo: localForm.ativo,
      cep: localForm.cep.trim(),
      logradouro: localForm.logradouro.trim(),
      numero: localForm.numero.trim(),
      complemento: localForm.complemento.trim(),
      bairro: localForm.bairro.trim(),
      pontoReferencia: localForm.pontoReferencia.trim(),
      cityCode: localForm.cityCode,
      latitude: lat,
      longitude: lng,
      contatoNome: localForm.contatoNome.trim(),
      contatoTelefone: localForm.contatoTelefone.trim(),
      codigoCheckin: localForm.codigoCheckin.trim(),
      codigoCheckout: localForm.codigoCheckout.trim(),
      observacoes: localForm.observacoes.trim()
    }
    if (localEditandoId.value) {
      await $api(`/clients/${clientId}/locais/${localEditandoId.value}`, { method: 'PATCH', body: payload })
      toast.add({ title: 'Local atualizado', icon: 'i-lucide-check', color: 'success' })
    } else {
      await $api(`/clients/${clientId}/locais`, { method: 'POST', body: payload })
      toast.add({ title: 'Local criado', icon: 'i-lucide-check', color: 'success' })
    }
    localOpen.value = false
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao salvar local'), icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    localSalvando.value = false
  }
}

const removendoLocal = ref<number | null>(null)
async function removerLocal(l: ClientLocal) {
  const ok = await confirm({
    title: 'Excluir local',
    message: `Excluir o local "${l.nome}"? Chamados já criados mantêm o endereço copiado.`,
    confirmLabel: 'Excluir',
    confirmColor: 'error',
    icon: 'i-lucide-trash-2'
  })
  if (!ok) return
  removendoLocal.value = l.id
  try {
    await $api(`/clients/${clientId}/locais/${l.id}`, { method: 'DELETE' })
    toast.add({ title: 'Local excluído', icon: 'i-lucide-check', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: mensagemErro(e, 'Erro ao excluir local'), icon: 'i-lucide-alert-circle', color: 'error' })
  } finally {
    removendoLocal.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="cliente-detalhe">
    <template #header>
      <UDashboardNavbar :title="cliente?.nomeFantasia || cliente?.nome || 'Cliente'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/clientes"
            aria-label="Voltar para clientes"
          />
        </template>
        <template #right>
          <UButton
            v-if="cliente && canEdit"
            label="Editar"
            icon="i-lucide-pencil"
            color="neutral"
            variant="subtle"
            :to="`/clientes/${cliente.id}/editar`"
          />
          <UButton
            v-if="cliente && canDelete"
            label="Excluir"
            icon="i-lucide-trash-2"
            color="error"
            variant="subtle"
            @click="deleteOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="error" class="py-16 text-center text-sm text-muted">
        Cliente não encontrado.
      </div>

      <template v-else-if="cliente">
        <!-- Cabeçalho -->
        <div class="flex items-center gap-4 mb-6">
          <UAvatar
            :icon="cliente.tipo === 'pj' ? 'i-lucide-building-2' : 'i-lucide-user'"
            size="xl"
          />
          <div>
            <h1 class="text-xl font-semibold text-highlighted flex items-center gap-2 flex-wrap">
              {{ cliente.nomeFantasia || cliente.nome }}
              <UBadge :color="cliente.tipo === 'pj' ? 'primary' : 'neutral'" variant="subtle" size="sm">
                {{ cliente.tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física' }}
              </UBadge>
              <UBadge
                v-if="!cliente.ativo"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                inativo
              </UBadge>
              <UBadge
                v-if="clientesFinais.length"
                color="info"
                variant="subtle"
                size="sm"
              >
                contratante
              </UBadge>
            </h1>
            <p v-if="cliente.nomeFantasia && cliente.tipo === 'pj'" class="text-muted text-sm">
              {{ cliente.nome }}
            </p>
            <p v-if="cliente.contratante" class="text-muted text-sm">
              Cliente final de
              <NuxtLink :to="`/clientes/${cliente.contratante.id}`" class="text-primary hover:underline">
                {{ cliente.contratante.nome }}
              </NuxtLink>
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Identificação -->
          <UPageCard title="Identificação" variant="subtle">
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">
                  {{ cliente.tipo === 'pj' ? 'Razão social' : 'Nome' }}
                </dt>
                <dd class="text-highlighted text-right">
                  {{ cliente.nome }}
                </dd>
              </div>
              <div v-if="cliente.tipo === 'pj'" class="flex justify-between gap-3">
                <dt class="text-muted">
                  Nome fantasia
                </dt>
                <dd class="text-highlighted text-right">
                  {{ cliente.nomeFantasia || '—' }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">
                  {{ cliente.tipo === 'pj' ? 'CNPJ' : 'CPF' }}
                </dt>
                <dd class="text-highlighted text-right">
                  {{ documento(cliente) }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">
                  Nota fiscal
                </dt>
                <dd class="text-highlighted text-right">
                  {{ cliente.emiteNotaFiscal ? 'Emite (com imposto)' : 'Não emite' }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">
                  Contratante
                </dt>
                <dd class="text-highlighted text-right">
                  <NuxtLink
                    v-if="cliente.contratante"
                    :to="`/clientes/${cliente.contratante.id}`"
                    class="text-primary hover:underline"
                  >
                    {{ cliente.contratante.nome }}
                  </NuxtLink>
                  <span v-else>— (cliente direto)</span>
                </dd>
              </div>
            </dl>
          </UPageCard>

          <!-- Contato -->
          <UPageCard title="Contato" variant="subtle">
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">
                  E-mail
                </dt>
                <dd class="text-highlighted text-right">
                  {{ cliente.email || '—' }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">
                  Telefone
                </dt>
                <dd class="text-highlighted text-right">
                  {{ cliente.telefone || '—' }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">
                  Pessoa de contato
                </dt>
                <dd class="text-highlighted text-right">
                  {{ cliente.contatoNome || '—' }}
                </dd>
              </div>
            </dl>
          </UPageCard>

          <!-- Endereço -->
          <UPageCard title="Endereço" variant="subtle">
            <p class="text-sm text-highlighted whitespace-pre-line">
              {{ enderecoCompleto(cliente) || '—' }}
            </p>
          </UPageCard>

          <!-- Observações -->
          <UPageCard v-if="cliente.observacoes" title="Observações" variant="subtle">
            <p class="text-sm text-highlighted whitespace-pre-line">
              {{ cliente.observacoes }}
            </p>
          </UPageCard>

          <!-- Locais -->
          <UPageCard
            variant="subtle"
            class="lg:col-span-2"
            :ui="{ container: 'p-0 sm:p-0', header: 'w-full' }"
          >
            <template #header>
              <div class="w-full flex items-center justify-between gap-3 p-4 border-b border-default">
                <div>
                  <p class="text-highlighted font-medium">
                    Locais de atendimento
                  </p>
                  <p class="text-muted text-xs">
                    Sites do cliente — ao abrir um chamado, o local preenche endereço, contato e códigos.
                  </p>
                </div>
                <UButton
                  v-if="canEdit"
                  label="Novo local"
                  icon="i-lucide-plus"
                  size="xs"
                  variant="subtle"
                  @click="abrirLocal()"
                />
              </div>
            </template>
            <div class="p-4">
              <p v-if="!locais.length" class="text-sm text-muted">
                Nenhum local cadastrado.
              </p>
              <ul v-else class="divide-y divide-default">
                <li
                  v-for="l in locais"
                  :key="l.id"
                  class="py-3 flex flex-wrap items-start justify-between gap-3 text-sm"
                >
                  <div class="min-w-0 space-y-1">
                    <p class="text-highlighted font-medium flex items-center gap-2">
                      <UIcon name="i-lucide-map-pin" class="size-4 shrink-0" />
                      {{ l.nome }}
                      <UBadge
                        v-if="!l.ativo"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                      >
                        inativo
                      </UBadge>
                      <UBadge
                        v-if="l.codigoCheckin || l.codigoCheckout"
                        color="warning"
                        variant="subtle"
                        size="sm"
                      >
                        exige código
                      </UBadge>
                    </p>
                    <p class="text-muted text-xs whitespace-pre-line">
                      {{ enderecoCompleto(l) || 'Sem endereço' }}
                    </p>
                    <p v-if="l.pontoReferencia" class="text-muted text-xs">
                      Referência: {{ l.pontoReferencia }}
                    </p>
                    <p v-if="l.contatoNome || l.contatoTelefone" class="text-xs">
                      <span class="text-muted">Contato:</span>
                      {{ l.contatoNome ?? '—' }}
                      <span v-if="l.contatoTelefone" class="text-muted">• {{ l.contatoTelefone }}</span>
                    </p>
                    <p v-if="podeGerenciarChamados && (l.codigoCheckin || l.codigoCheckout)" class="text-xs font-mono">
                      <span class="text-muted font-sans">Códigos:</span>
                      {{ l.codigoCheckin || '—' }} / {{ l.codigoCheckout || '—' }}
                    </p>
                    <a
                      v-if="l.latitude != null && l.longitude != null"
                      :href="mapsUrl(l.latitude, l.longitude)"
                      target="_blank"
                      rel="noopener"
                      class="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <UIcon name="i-lucide-map" class="size-3.5" />
                      {{ l.latitude.toFixed(5) }}, {{ l.longitude.toFixed(5) }}
                    </a>
                  </div>
                  <div v-if="canEdit" class="flex items-center gap-1 shrink-0">
                    <UButton
                      icon="i-lucide-pencil"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      aria-label="Editar local"
                      @click="abrirLocal(l)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      size="xs"
                      color="error"
                      variant="ghost"
                      aria-label="Excluir local"
                      :loading="removendoLocal === l.id"
                      @click="removerLocal(l)"
                    />
                  </div>
                </li>
              </ul>
            </div>
          </UPageCard>

          <!-- Clientes finais (quando é contratante) -->
          <UPageCard
            v-if="clientesFinais.length"
            title="Clientes finais"
            description="Clientes atendidos por meio deste contratante."
            variant="subtle"
            class="lg:col-span-2"
          >
            <ul class="divide-y divide-default text-sm">
              <li
                v-for="cf in clientesFinais"
                :key="cf.id"
                class="py-2 flex items-center justify-between gap-3"
              >
                <NuxtLink :to="`/clientes/${cf.id}`" class="text-highlighted hover:text-primary truncate">
                  {{ cf.nomeFantasia || cf.nome }}
                </NuxtLink>
                <span class="text-muted text-xs shrink-0">
                  {{ cf.city ? `${cf.city.nome}/${cf.city.uf}` : '' }}
                  <UBadge
                    v-if="!cf.ativo"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    class="ml-1"
                  >
                    inativo
                  </UBadge>
                </span>
              </li>
            </ul>
          </UPageCard>
        </div>
      </template>
    </template>
  </UDashboardPanel>

  <UModal
    v-model:open="deleteOpen"
    title="Excluir cliente"
    :description="`Tem certeza que deseja excluir ${cliente?.nomeFantasia || cliente?.nome}? Esta ação não pode ser desfeita.`"
  >
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="subtle"
          @click="deleteOpen = false"
        />
        <UButton
          label="Excluir"
          color="error"
          icon="i-lucide-trash-2"
          :loading="deleting"
          @click="confirmRemove"
        />
      </div>
    </template>
  </UModal>

  <!-- Modal: local -->
  <UModal
    v-model:open="localOpen"
    :title="localEditandoId ? 'Editar local' : 'Novo local'"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex items-start gap-4">
          <UFormField
            label="Nome do local"
            required
            :error="localErro || undefined"
            class="flex-1"
          >
            <UInput v-model="localForm.nome" class="w-full" placeholder="Ex.: Loja Centro, Filial Norte…" />
          </UFormField>
          <USwitch v-model="localForm.ativo" label="Ativo" class="mt-6" />
        </div>

        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold uppercase text-muted">
            Endereço
          </p>
          <UButton
            label="Copiar do cliente"
            icon="i-lucide-copy"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="copiarEnderecoCliente"
          />
        </div>
        <AddressForm
          :key="localKey"
          v-model:cep="localForm.cep"
          v-model:logradouro="localForm.logradouro"
          v-model:numero="localForm.numero"
          v-model:complemento="localForm.complemento"
          v-model:bairro="localForm.bairro"
          v-model:city-code="localForm.cityCode"
          :city-initial-label="localCityLabel"
        />
        <UFormField label="Ponto de referência">
          <UInput v-model="localForm.pontoReferencia" class="w-full" placeholder="Ex.: ao lado da farmácia" />
        </UFormField>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Latitude" help="Opcional — valida a distância do check-in">
            <UInput
              v-model="localForm.latitude"
              type="number"
              step="any"
              class="w-full"
              placeholder="-3.119"
            />
          </UFormField>
          <UFormField label="Longitude">
            <UInput
              v-model="localForm.longitude"
              type="number"
              step="any"
              class="w-full"
              placeholder="-60.021"
            />
          </UFormField>
        </div>

        <p class="text-xs font-semibold uppercase text-muted">
          Contato no local
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Nome">
            <UInput v-model="localForm.contatoNome" class="w-full" />
          </UFormField>
          <UFormField label="Telefone">
            <UInput v-model="localForm.contatoTelefone" class="w-full" placeholder="(00) 00000-0000" />
          </UFormField>
        </div>

        <p class="text-xs font-semibold uppercase text-muted">
          Códigos de check-in / check-out
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Código de check-in" help="Vazio = não exige">
            <UInput v-model="localForm.codigoCheckin" class="w-full" />
          </UFormField>
          <UFormField label="Código de check-out" help="Vazio = não exige">
            <UInput v-model="localForm.codigoCheckout" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Observações">
          <UTextarea v-model="localForm.observacoes" class="w-full" :rows="2" />
        </UFormField>

        <div class="flex justify-end gap-2 border-t border-default pt-4">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="subtle"
            @click="localOpen = false"
          />
          <UButton
            :label="localEditandoId ? 'Salvar' : 'Criar local'"
            icon="i-lucide-check"
            :loading="localSalvando"
            @click="salvarLocal"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
