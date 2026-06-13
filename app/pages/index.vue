<script setup lang="ts">
import { ref, reactive } from 'vue'

definePageMeta({ layout: 'public' })

useHead({
  title: 'Cadastro de Técnico Parceiro — 3CORE Tecnologia',
  meta: [
    {
      name: 'description',
      content:
        'Faça seu cadastro na rede de técnicos prestadores de serviço da 3CORE Tecnologia.'
    },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ]
})

const AREAS_GRUPOS = [
  {
    grupo: 'Suporte e Atendimento',
    itens: [
      'Suporte Técnico (Help Desk)',
      'Triagem / Mesa de Atendimento',
      'Atendimento N1, N2 e N3',
      'Suporte remoto e presencial',
      'Troubleshooting de hardware e software',
      'Atendimento a usuários finais'
    ]
  },
  {
    grupo: 'Infraestrutura e Redes',
    itens: [
      'Infraestrutura de Rede',
      'Cabeamento estruturado',
      'Conexão de cabo / cabeamento',
      'Configuração de redes LAN/WAN',
      'Configuração de roteadores e switches',
      'Instalação e configuração de Wi-Fi',
      'Monitoramento de links e dispositivos',
      'VPN e firewall'
    ]
  },
  {
    grupo: 'Instalação e Campo',
    itens: [
      'Field Service',
      'Instalação de equipamentos',
      'Implantação de estações de trabalho',
      'Instalação de monitores e players',
      'Instalação de racks e organização',
      'Passagem de cabos',
      'Instalação de monitor profissional',
      'Instalação de telas acima de 50"',
      'Instalação de videowall',
      'Instalação de painel de LED',
      'Estruturação e fixação de telas',
      'Configuração de players Android/Windows',
      'Instalação de Digital Signage / DOOH'
    ]
  },
  {
    grupo: 'Hardware e Manutenção',
    itens: [
      'Manutenção de hardware',
      'Upgrade de equipamentos',
      'Troca de peças',
      'Limpeza técnica',
      'Montagem e desmontagem de equipamentos',
      'Diagnóstico técnico'
    ]
  },
  {
    grupo: 'Sistemas e Software',
    itens: [
      'Configuração de software',
      'Instalação de sistemas operacionais',
      'Configuração de aplicativos corporativos',
      'Backup e restauração',
      'Formatação e imagem de sistemas'
    ]
  },
  {
    grupo: 'Servidores e Datacenter',
    itens: [
      'Administração de servidores Windows/Linux',
      'Virtualização',
      'Active Directory',
      'Gerenciamento de storage',
      'Monitoramento de servidores',
      'Administração de serviços de rede'
    ]
  },
  {
    grupo: 'Segurança e Monitoramento',
    itens: [
      'CFTV / Câmeras de Segurança',
      'Controle de acesso',
      'Segurança da informação',
      'Auditoria e compliance',
      'Gestão de políticas de segurança'
    ]
  },
  {
    grupo: 'Telecom e Periféricos',
    itens: [
      'Telefonia / VOIP',
      'Impressoras e periféricos',
      'Configuração de scanners',
      'Configuração de coletores',
      'Dispositivos USB e serial'
    ]
  },
  {
    grupo: 'Especialidades',
    itens: [
      'Digital Signage / DOOH',
      'ATM / Totens de autoatendimento',
      'POS / PDV',
      'Equipamentos industriais',
      'Smart TVs e players Android',
      'Automação comercial',
      'Painel de LED indoor/outdoor',
      'Monitores corporativos Samsung/LG/Philips',
      'Sincronização de videowall',
      'Instalação com suporte articulado/teto/parede'
    ]
  }
]

const FERRAMENTAS_GRUPOS = [
  {
    grupo: 'Equipamentos Básicos',
    itens: [
      'Notebook (TeamViewer / PuTTY / AnyDesk)',
      'Smartphone com acesso 4G/pacote de dados',
      'Pendrive bootável',
      'HD externo',
      'Imagem de Sistema Operacional',
      'Software Hiren\'s Boot',
      'Pasta térmica',
      'Celular Android com disponibilidade de dados'
    ]
  },
  {
    grupo: 'Ferramentas de Rede (Networking)',
    itens: [
      'Alicate de corte',
      'Alicate de crimpar',
      'Pushdown',
      'Chaves de fenda',
      'Chave Phillips',
      'Kit chave Allen',
      'Kit chave Torx',
      'Conectores RJ45',
      'Conectores Keystone',
      'Cabo de rede para testes',
      'Jumpers UTP CAT6 (direto e cross)',
      'Cabos console',
      'Cabo USB serial',
      'Testador de cabo',
      'Etiquetas adesivas / fita crepe',
      'Pulseira antiestática',
      'Multímetro',
      'Etiquetadora',
      'Localizador de Cabo (Zumbidor)',
      'Furadeira',
      'Parafusadeira'
    ]
  },
  {
    grupo: 'Itens para Players / Monitores / DOOH',
    itens: [
      'Tela/monitor de apoio (HDMI)',
      'Fone P2',
      'Controle remoto universal',
      'Teclado',
      'Mouse',
      'Cabo USB',
      'Cabo HDMI',
      'Cabo DisplayPort',
      'Adaptador HDMI/VGA'
    ]
  }
]

const form = reactive({
  nomeCompleto: '',
  cpf: '',
  rg: '',
  email: '',
  celular: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  mesmoEnderecoEncomendas: true,
  enderecoEncomendas: '',
  pix: { chavePix: '', nomeTitularPix: '' },
  dadosBancarios: { banco: '', agencia: '', conta: '', tipoConta: 'corrente' },
  possuiEmpresa: false,
  empresa: { nomeFantasia: '', razaoSocial: '', cnpj: '' },
  areasAtuacao: [] as string[],
  ferramental: [] as string[],
  pretensaoValorHora: '',
  custoPorKm: '',
  cidadesAtendidas: [] as { cidade: string, custoKm: string }[]
})

const isLoading = ref(false)
const submitSuccess = ref(false)
const submitError = ref('')
const cepLoading = ref(false)
const erros = reactive<Record<string, string>>({})
const novaCidade = reactive({ cidade: '', custoKm: '' })

const TOTAL_STEPS = 7
const stepAtual = ref(1)

const STEPS = [
  { titulo: 'Dados Pessoais e Endereço' },
  { titulo: 'Dados de Pagamento' },
  { titulo: 'Dados da Empresa' },
  { titulo: 'Áreas de Atuação' },
  { titulo: 'Ferramental Técnico' },
  { titulo: 'Pretensão Financeira' },
  { titulo: 'Região de Atendimento' }
]

function aplicarMascaraCpf(event: Event) {
  const input = event.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 11)
  if (v.length > 9)
    v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`
  else if (v.length > 6) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`
  else if (v.length > 3) v = `${v.slice(0, 3)}.${v.slice(3)}`
  form.cpf = v
  input.value = v
}

function aplicarMascaraCep(event: Event) {
  const input = event.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 8)
  if (v.length > 5) v = `${v.slice(0, 5)}-${v.slice(5)}`
  form.cep = v
  input.value = v
  if (v.replace(/\D/g, '').length === 8) buscarCep()
}

function aplicarMascaraCelular(event: Event) {
  const input = event.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 11)
  if (v.length > 10) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
  else if (v.length > 6)
    v = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`
  else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`
  else if (v.length > 0) v = `(${v}`
  form.celular = v
  input.value = v
}

function aplicarMascaraCnpj(event: Event) {
  const input = event.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 14)
  if (v.length > 12)
    v = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`
  else if (v.length > 8)
    v = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`
  else if (v.length > 5) v = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`
  else if (v.length > 2) v = `${v.slice(0, 2)}.${v.slice(2)}`
  form.empresa.cnpj = v
  input.value = v
}

async function buscarCep() {
  const cepLimpo = form.cep.replace(/\D/g, '')
  if (cepLimpo.length !== 8) return
  cepLoading.value = true
  try {
    const data = await $fetch<{
      logradouro?: string
      bairro?: string
      localidade?: string
      uf?: string
      erro?: boolean
    }>(`https://viacep.com.br/ws/${cepLimpo}/json/`)
    if (!data.erro) {
      form.logradouro = data.logradouro ?? ''
      form.bairro = data.bairro ?? ''
      form.cidade = data.localidade ?? ''
      form.estado = data.uf ?? ''
    }
  } catch {
    // CEP não localizado — usuário preenche manualmente
  } finally {
    cepLoading.value = false
  }
}

function adicionarCidade() {
  if (!novaCidade.cidade.trim()) return
  form.cidadesAtendidas.push({
    cidade: novaCidade.cidade.trim(),
    custoKm: novaCidade.custoKm.trim()
  })
  novaCidade.cidade = ''
  novaCidade.custoKm = ''
}

function removerCidade(index: number) {
  form.cidadesAtendidas.splice(index, 1)
}

function validarStep(step: number): boolean {
  const novo: Record<string, string> = {}

  if (step === 1) {
    if (!form.nomeCompleto.trim())
      novo.nomeCompleto = 'Nome completo é obrigatório.'
    if (form.cpf.replace(/\D/g, '').length < 11)
      novo.cpf = 'Informe um CPF válido com 11 dígitos.'
    if (
      !form.email.trim()
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    )
      novo.email = 'Informe um e-mail válido.'
    if (form.celular.replace(/\D/g, '').length < 10)
      novo.celular = 'Informe um celular válido com DDD.'
    if (form.cep.replace(/\D/g, '').length < 8)
      novo.cep = 'Informe um CEP válido com 8 dígitos.'
    if (!form.logradouro.trim()) novo.logradouro = 'Endereço é obrigatório.'
    if (!form.numero.trim()) novo.numero = 'Número é obrigatório.'
    if (!form.mesmoEnderecoEncomendas && !form.enderecoEncomendas.trim())
      novo.enderecoEncomendas
        = 'Informe o endereço para recebimento de encomendas.'
  }

  if (step === 2) {
    const temPix = !!form.pix.chavePix.trim()
    const temBanco = !!(
      form.dadosBancarios.banco.trim()
      && form.dadosBancarios.agencia.trim()
      && form.dadosBancarios.conta.trim()
    )
    if (!temPix && !temBanco)
      novo.pagamento
        = 'Informe ao menos uma forma de pagamento (Pix ou transferência bancária).'
  }

  if (step === 4) {
    if (form.areasAtuacao.length === 0)
      novo.areasAtuacao = 'Selecione ao menos uma área de atuação.'
  }

  if (step === 5) {
    // ferramental é opcional — sem validação obrigatória
  }

  Object.keys(erros).forEach((k) => {
    if (!novo[k]) delete erros[k]
  })
  Object.assign(erros, novo)

  return Object.keys(novo).length === 0
}

async function avancar() {
  if (!validarStep(stepAtual.value)) {
    await nextTick()
    document
      .querySelector('[data-campo-erro]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  if (stepAtual.value < TOTAL_STEPS) {
    stepAtual.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function voltar() {
  if (stepAtual.value > 1) {
    Object.keys(erros).forEach(k => delete erros[k])
    stepAtual.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const config = useRuntimeConfig()

async function handleSubmit() {
  submitError.value = ''
  isLoading.value = true

  const payload = {
    nome: form.nomeCompleto,
    cpf: form.cpf.replace(/\D/g, ''),
    rg: form.rg,
    email: form.email,
    celular: form.celular.replace(/\D/g, ''),
    endereco: {
      cep: form.cep.replace(/\D/g, ''),
      logradouro: form.logradouro,
      numero: form.numero,
      complemento: form.complemento,
      bairro: form.bairro,
      cidade: form.cidade,
      estado: form.estado
    },
    enderecoEncomendas: form.mesmoEnderecoEncomendas
      ? `${form.logradouro}, ${form.numero}${form.complemento ? ' ' + form.complemento : ''} — ${form.bairro}, ${form.cidade}/${form.estado}`
      : form.enderecoEncomendas,
    pagamento: {
      pix: form.pix.chavePix.trim()
        ? {
            chavePix: form.pix.chavePix.trim(),
            nomeTitularPix: form.pix.nomeTitularPix.trim()
          }
        : null,
      dadosBancarios:
        form.dadosBancarios.banco.trim()
        && form.dadosBancarios.agencia.trim()
        && form.dadosBancarios.conta.trim()
          ? { ...form.dadosBancarios }
          : null
    },
    empresa: form.possuiEmpresa
      ? {
          nomeFantasia: form.empresa.nomeFantasia,
          razaoSocial: form.empresa.razaoSocial,
          cnpj: form.empresa.cnpj.replace(/\D/g, '')
        }
      : null,
    areasAtuacao: form.areasAtuacao,
    ferramental: form.ferramental,
    pretensaoValorHora: form.pretensaoValorHora || null,
    custoPorKm: form.custoPorKm || null,
    cidadesAtendidas: form.cidadesAtendidas
  }

  try {
    await $fetch(`${config.public.apiBase}/leads/tech`, {
      method: 'POST',
      body: payload
    })
    submitSuccess.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    submitError.value
      = err?.data?.message
        ?? 'Ocorreu um erro ao enviar. Tente novamente mais tarde.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans">
    <!-- HEADER -->
    <header>
      <div class="bg-brand-blue text-white shadow-lg">
        <div class="max-w-2xl mx-auto px-4 py-4 flex justify-center">
          <img src="/logo.jpeg" alt="3CORE Tecnologia" class="h-16 w-auto">
        </div>
        <div class="max-w-2xl mx-auto px-4 py-5">
          <h1 class="text-lg sm:text-xl font-bold leading-tight">
            Cadastro de Técnico Parceiro
          </h1>
          <p class="mt-2 text-sm text-blue-100 leading-relaxed">
            Faça parte da nossa rede de técnicos prestadores de serviço.
            Preencha os campos abaixo — leva menos de 5 minutos!
          </p>
        </div>
      </div>
    </header>

    <!-- TELA DE SUCESSO -->
    <div v-if="submitSuccess" class="max-w-2xl mx-auto px-4 py-12">
      <div class="bg-white rounded-2xl shadow-md p-8 text-center">
        <div
          class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5"
        >
          <svg
            class="w-10 h-10 text-green-500"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">
          Cadastro Enviado!
        </h2>
        <p class="text-gray-500 leading-relaxed">
          Recebemos suas informações com sucesso. Nossa equipe entrará em
          contato em breve pelo telefone ou e-mail cadastrado.
        </p>
        <div
          class="mt-6 inline-flex items-center gap-2 bg-brand-blue/10 text-brand-blue px-4 py-2 rounded-full text-sm font-medium"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clip-rule="evenodd"
            />
          </svg>
          Análise em até 2 dias úteis
        </div>
      </div>
    </div>

    <!-- FORMULÁRIO -->
    <form
      v-else
      novalidate
      class="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-32 md:pb-10"
      @submit.prevent="handleSubmit"
    >
      <!-- SEÇÃO 1 — Dados Pessoais e Endereço -->
      <section
        v-if="stepAtual === 1"
        class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="flex items-center gap-3 bg-brand-blue px-4 py-3">
          <span
            class="w-7 h-7 rounded-full bg-brand-orange flex items-center justify-center text-white text-sm font-bold shrink-0"
          >1</span>
          <h2 class="text-white font-semibold text-base">
            Dados Pessoais e Endereço
          </h2>
        </div>

        <div class="p-4 space-y-4">
          <div :data-campo-erro="!!erros.nomeCompleto || undefined">
            <label class="label-field">Nome Completo <span class="text-brand-orange">*</span></label>
            <input
              v-model="form.nomeCompleto"
              type="text"
              placeholder="Ex.: João da Silva"
              autocomplete="name"
              class="input-field"
              :class="{
                'border-red-400 focus:ring-red-300': erros.nomeCompleto
              }"
            >
            <p v-if="erros.nomeCompleto" class="msg-erro">
              {{ erros.nomeCompleto }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div :data-campo-erro="!!erros.cpf || undefined">
              <label class="label-field">CPF <span class="text-brand-orange">*</span></label>
              <input
                :value="form.cpf"
                type="text"
                inputmode="numeric"
                placeholder="000.000.000-00"
                maxlength="14"
                autocomplete="off"
                class="input-field"
                :class="{ 'border-red-400 focus:ring-red-300': erros.cpf }"
                @input="aplicarMascaraCpf"
              >
              <p v-if="erros.cpf" class="msg-erro">
                {{ erros.cpf }}
              </p>
            </div>
            <div>
              <label class="label-field">RG</label>
              <input
                v-model="form.rg"
                type="text"
                inputmode="numeric"
                placeholder="00.000.000-0"
                maxlength="15"
                autocomplete="off"
                class="input-field"
              >
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div :data-campo-erro="!!erros.email || undefined">
              <label class="label-field">E-mail <span class="text-brand-orange">*</span></label>
              <input
                v-model="form.email"
                type="email"
                inputmode="email"
                placeholder="seu@email.com"
                autocomplete="email"
                class="input-field"
                :class="{ 'border-red-400 focus:ring-red-300': erros.email }"
              >
              <p v-if="erros.email" class="msg-erro">
                {{ erros.email }}
              </p>
            </div>
            <div :data-campo-erro="!!erros.celular || undefined">
              <label class="label-field">Celular <span class="text-brand-orange">*</span></label>
              <input
                :value="form.celular"
                type="tel"
                inputmode="numeric"
                placeholder="(11) 99999-9999"
                maxlength="15"
                autocomplete="tel"
                class="input-field"
                :class="{ 'border-red-400 focus:ring-red-300': erros.celular }"
                @input="aplicarMascaraCelular"
              >
              <p v-if="erros.celular" class="msg-erro">
                {{ erros.celular }}
              </p>
            </div>
          </div>

          <hr class="border-gray-100 my-1">
          <p
            class="text-xs font-semibold uppercase tracking-wider text-gray-400"
          >
            Endereço
          </p>

          <div :data-campo-erro="!!erros.cep || undefined">
            <label class="label-field">CEP <span class="text-brand-orange">*</span></label>
            <div class="relative">
              <input
                :value="form.cep"
                type="text"
                inputmode="numeric"
                placeholder="00000-000"
                maxlength="9"
                autocomplete="postal-code"
                class="input-field pr-10"
                :class="{ 'border-red-400 focus:ring-red-300': erros.cep }"
                @input="aplicarMascaraCep"
              >
              <span
                v-if="cepLoading"
                class="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <svg
                  class="w-4 h-4 text-brand-blue animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              </span>
            </div>
            <p v-if="erros.cep" class="msg-erro">
              {{ erros.cep }}
            </p>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div
              class="col-span-2"
              :data-campo-erro="!!erros.logradouro || undefined"
            >
              <label class="label-field">Logradouro <span class="text-brand-orange">*</span></label>
              <input
                v-model="form.logradouro"
                type="text"
                placeholder="Rua, Av., Alameda..."
                autocomplete="street-address"
                class="input-field"
                :class="{
                  'border-red-400 focus:ring-red-300': erros.logradouro
                }"
              >
              <p v-if="erros.logradouro" class="msg-erro">
                {{ erros.logradouro }}
              </p>
            </div>
            <div :data-campo-erro="!!erros.numero || undefined">
              <label class="label-field">Nº <span class="text-brand-orange">*</span></label>
              <input
                v-model="form.numero"
                type="text"
                inputmode="numeric"
                placeholder="123"
                class="input-field"
                :class="{ 'border-red-400 focus:ring-red-300': erros.numero }"
              >
              <p v-if="erros.numero" class="msg-erro">
                {{ erros.numero }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label-field">Complemento</label>
              <input
                v-model="form.complemento"
                type="text"
                placeholder="Apto, Bloco..."
                class="input-field"
              >
            </div>
            <div>
              <label class="label-field">Bairro</label>
              <input
                v-model="form.bairro"
                type="text"
                placeholder="Centro"
                class="input-field"
              >
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="label-field">Cidade</label>
              <input
                v-model="form.cidade"
                type="text"
                placeholder="São Paulo"
                class="input-field"
              >
            </div>
            <div>
              <label class="label-field">Estado</label>
              <input
                v-model="form.estado"
                type="text"
                placeholder="SP"
                maxlength="2"
                class="input-field uppercase"
              >
            </div>
          </div>

          <hr class="border-gray-100 my-1">
          <div
            class="rounded-xl border-2 border-brand-orange/30 bg-orange-50 p-4 space-y-3"
          >
            <div class="flex items-start gap-2">
              <svg
                class="w-5 h-5 text-brand-orange mt-0.5 shrink-0"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 3H8l-2 4h12l-2-4z"
                />
              </svg>
              <div>
                <p class="text-sm font-semibold text-gray-800">
                  Endereço para Recebimento de Encomendas / Equipamentos
                </p>
                <p class="text-xs text-gray-500 mt-0.5">
                  Utilizado para envio de ferramentas e equipamentos pela 3CORE.
                </p>
              </div>
            </div>
            <label class="flex items-center gap-3 cursor-pointer select-none">
              <input
                v-model="form.mesmoEnderecoEncomendas"
                type="checkbox"
                class="w-5 h-5 rounded accent-brand-orange"
              >
              <span class="text-sm text-gray-700 font-medium">Mesmo endereço do CEP informado acima</span>
            </label>
            <div
              v-if="!form.mesmoEnderecoEncomendas"
              :data-campo-erro="!!erros.enderecoEncomendas || undefined"
            >
              <input
                v-model="form.enderecoEncomendas"
                type="text"
                placeholder="Rua, Nº, Bairro, Cidade/UF — CEP 00000-000"
                class="input-field"
                :class="{
                  'border-red-400 focus:ring-red-300': erros.enderecoEncomendas
                }"
              >
              <p v-if="erros.enderecoEncomendas" class="msg-erro">
                {{ erros.enderecoEncomendas }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- SEÇÃO 2 — Dados de Pagamento -->
      <section
        v-if="stepAtual === 2"
        class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="flex items-center gap-3 bg-brand-blue px-4 py-3">
          <span
            class="w-7 h-7 rounded-full bg-brand-orange flex items-center justify-center text-white text-sm font-bold shrink-0"
          >2</span>
          <h2 class="text-white font-semibold text-base">
            Dados de Pagamento
          </h2>
        </div>
        <div class="p-4 space-y-4">
          <p class="text-xs text-gray-500 -mt-1">
            Informe ao menos uma forma de pagamento (Pix ou transferência
            bancária).
          </p>
          <div
            v-if="erros.pagamento"
            :data-campo-erro="true"
            class="rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <p class="msg-erro">
              {{ erros.pagamento }}
            </p>
          </div>
          <div class="rounded-xl border-2 border-gray-100 p-4 space-y-3">
            <p class="text-sm font-semibold text-gray-800">
              Pix
            </p>
            <div>
              <label class="label-field">Chave Pix</label>
              <input
                v-model="form.pix.chavePix"
                type="text"
                placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                class="input-field"
              >
            </div>
            <div>
              <label class="label-field">Nome do Titular da Conta Pix</label>
              <input
                v-model="form.pix.nomeTitularPix"
                type="text"
                placeholder="Nome exato como cadastrado no Pix"
                class="input-field"
              >
            </div>
          </div>
          <div class="flex items-center gap-3">
            <hr class="flex-1 border-gray-200">
            <span class="text-xs font-semibold text-gray-400 uppercase">ou</span>
            <hr class="flex-1 border-gray-200">
          </div>
          <div class="rounded-xl border-2 border-gray-100 p-4 space-y-3">
            <p class="text-sm font-semibold text-gray-800">
              Transferência Bancária (TED/DOC)
            </p>
            <div>
              <label class="label-field">Banco</label>
              <input
                v-model="form.dadosBancarios.banco"
                type="text"
                placeholder="Ex.: Itaú, Bradesco, Nubank..."
                class="input-field"
              >
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label-field">Agência</label>
                <input
                  v-model="form.dadosBancarios.agencia"
                  type="text"
                  inputmode="numeric"
                  placeholder="0000"
                  class="input-field"
                >
              </div>
              <div>
                <label class="label-field">Conta</label>
                <input
                  v-model="form.dadosBancarios.conta"
                  type="text"
                  inputmode="numeric"
                  placeholder="00000-0"
                  class="input-field"
                >
              </div>
            </div>
            <div>
              <label class="label-field">Tipo de Conta</label>
              <div class="flex gap-6 mt-1.5">
                <label
                  class="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    v-model="form.dadosBancarios.tipoConta"
                    type="radio"
                    value="corrente"
                    class="accent-brand-blue"
                  >
                  <span class="text-sm text-gray-700">Corrente</span>
                </label>
                <label
                  class="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    v-model="form.dadosBancarios.tipoConta"
                    type="radio"
                    value="poupanca"
                    class="accent-brand-blue"
                  >
                  <span class="text-sm text-gray-700">Poupança</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SEÇÃO 3 — Dados da Empresa -->
      <section
        v-if="stepAtual === 3"
        class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="flex items-center gap-3 bg-brand-blue px-4 py-3">
          <span
            class="w-7 h-7 rounded-full bg-brand-orange flex items-center justify-center text-white text-sm font-bold shrink-0"
          >3</span>
          <h2 class="text-white font-semibold text-base">
            Dados da Empresa
            <span class="text-xs font-normal text-blue-200 ml-1">(opcional)</span>
          </h2>
        </div>
        <div class="p-4 space-y-4">
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <input
              v-model="form.possuiEmpresa"
              type="checkbox"
              class="w-5 h-5 rounded accent-brand-orange"
            >
            <span class="text-sm text-gray-700 font-medium">Possuo empresa (MEI, EIRELI, Ltda., etc.) em meu nome</span>
          </label>
          <div v-if="form.possuiEmpresa" class="space-y-3">
            <div>
              <label class="label-field">Nome Fantasia</label>
              <input
                v-model="form.empresa.nomeFantasia"
                type="text"
                placeholder="Ex.: Tech Solutions"
                class="input-field"
              >
            </div>
            <div>
              <label class="label-field">Razão Social</label>
              <input
                v-model="form.empresa.razaoSocial"
                type="text"
                placeholder="Ex.: João da Silva Informática ME"
                class="input-field"
              >
            </div>
            <div>
              <label class="label-field">CNPJ</label>
              <input
                :value="form.empresa.cnpj"
                type="text"
                inputmode="numeric"
                placeholder="00.000.000/0000-00"
                maxlength="18"
                autocomplete="off"
                class="input-field"
                @input="aplicarMascaraCnpj"
              >
            </div>
          </div>
        </div>
      </section>

      <!-- SEÇÃO 4 — Áreas de Atuação -->
      <section
        v-if="stepAtual === 4"
        class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="flex items-center gap-3 bg-brand-blue px-4 py-3">
          <span
            class="w-7 h-7 rounded-full bg-brand-orange flex items-center justify-center text-white text-sm font-bold shrink-0"
          >4</span>
          <h2 class="text-white font-semibold text-base">
            Áreas de Atuação
          </h2>
        </div>
        <div class="p-4 space-y-5">
          <div :data-campo-erro="!!erros.areasAtuacao || undefined">
            <p class="text-sm font-semibold text-gray-700 mb-1">
              Áreas de Atuação <span class="text-brand-orange">*</span>
            </p>
            <p class="text-xs text-gray-400 mb-3">
              Selecione todas que se aplicam.
            </p>
            <div class="space-y-4">
              <div v-for="grupo in AREAS_GRUPOS" :key="grupo.grupo">
                <p
                  class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
                >
                  {{ grupo.grupo }}
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    v-for="area in grupo.itens"
                    :key="area"
                    class="checkbox-card"
                    :class="{
                      'border-brand-blue bg-blue-50':
                        form.areasAtuacao.includes(area)
                    }"
                  >
                    <input
                      v-model="form.areasAtuacao"
                      type="checkbox"
                      :value="area"
                      class="sr-only"
                    >
                    <span
                      class="w-5 h-5 rounded border-2 border-gray-300 shrink-0 flex items-center justify-center transition-colors"
                      :class="{
                        'border-brand-blue bg-brand-blue':
                          form.areasAtuacao.includes(area)
                      }"
                    >
                      <svg
                        v-if="form.areasAtuacao.includes(area)"
                        class="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    <span class="text-sm text-gray-700 leading-tight">{{
                      area
                    }}</span>
                  </label>
                </div>
              </div>
            </div>
            <p v-if="erros.areasAtuacao" class="msg-erro mt-2">
              {{ erros.areasAtuacao }}
            </p>
          </div>
        </div>
      </section>

      <!-- SEÇÃO 5 — Ferramental Técnico -->
      <section
        v-if="stepAtual === 5"
        class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="flex items-center gap-3 bg-brand-blue px-4 py-3">
          <span
            class="w-7 h-7 rounded-full bg-brand-orange flex items-center justify-center text-white text-sm font-bold shrink-0"
          >5</span>
          <h2 class="text-white font-semibold text-base">
            Ferramental Técnico Disponível
          </h2>
        </div>
        <div class="p-4 space-y-5">
          <div>
            <p class="text-sm font-semibold text-gray-700 mb-1">
              Ferramental Técnico Disponível
            </p>
            <p class="text-xs text-gray-400 mb-3">
              Informe quais ferramentas / equipamentos você possui.
            </p>
            <div class="space-y-4">
              <div v-for="grupo in FERRAMENTAS_GRUPOS" :key="grupo.grupo">
                <p
                  class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
                >
                  {{ grupo.grupo }}
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    v-for="tool in grupo.itens"
                    :key="tool"
                    class="checkbox-card"
                    :class="{
                      'border-brand-orange bg-orange-50':
                        form.ferramental.includes(tool)
                    }"
                  >
                    <input
                      v-model="form.ferramental"
                      type="checkbox"
                      :value="tool"
                      class="sr-only"
                    >
                    <span
                      class="w-5 h-5 rounded border-2 border-gray-300 shrink-0 flex items-center justify-center transition-colors"
                      :class="{
                        'border-brand-orange bg-brand-orange':
                          form.ferramental.includes(tool)
                      }"
                    >
                      <svg
                        v-if="form.ferramental.includes(tool)"
                        class="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    <span class="text-sm text-gray-700 leading-tight">{{
                      tool
                    }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SEÇÃO 6 — Pretensão Financeira -->
      <section
        v-if="stepAtual === 6"
        class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="flex items-center gap-3 bg-brand-blue px-4 py-3">
          <span
            class="w-7 h-7 rounded-full bg-brand-orange flex items-center justify-center text-white text-sm font-bold shrink-0"
          >6</span>
          <h2 class="text-white font-semibold text-base">
            Pretensão Financeira e Logística
          </h2>
        </div>
        <div class="p-4 space-y-4">
          <p class="text-xs text-gray-400 -mt-1">
            Campos opcionais — preencha conforme sua preferência.
          </p>
          <div>
            <label class="label-field">Pretensão de Valor por Atendimento / Período
              <span class="text-xs font-normal text-gray-400 ml-1">(opcional)</span></label>
            <input
              v-model="form.pretensaoValorHora"
              type="text"
              inputmode="decimal"
              placeholder="Ex.: R$ 150,00 por período de 3 horas"
              class="input-field"
            >
          </div>
          <div>
            <label class="label-field">Adicional por Quilômetro Rodado (Custo KM)
              <span class="text-xs font-normal text-gray-400 ml-1">(opcional)</span></label>
            <div class="relative">
              <span
                class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium select-none"
              >R$</span>
              <input
                v-model="form.custoPorKm"
                type="text"
                inputmode="decimal"
                placeholder="0,00"
                class="input-field pl-10"
              >
            </div>
          </div>
        </div>
      </section>

      <!-- SEÇÃO 7 — Região de Atendimento -->
      <section
        v-if="stepAtual === 7"
        class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="flex items-center gap-3 bg-brand-blue px-4 py-3">
          <span
            class="w-7 h-7 rounded-full bg-brand-orange flex items-center justify-center text-white text-sm font-bold shrink-0"
          >7</span>
          <h2 class="text-white font-semibold text-base">
            Região de Atendimento
          </h2>
        </div>
        <div class="p-4 space-y-4">
          <p class="text-xs text-gray-500">
            Adicione as cidades que você consegue cobrir além da sua cidade
            base.
          </p>
          <div class="bg-gray-50 rounded-xl p-3 space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label-field">Nome da Cidade</label>
                <input
                  v-model="novaCidade.cidade"
                  type="text"
                  placeholder="Ex.: Campinas"
                  class="input-field"
                  @keydown.enter.prevent="adicionarCidade"
                >
              </div>
              <div>
                <label class="label-field">Custo de Deslocamento</label>
                <div class="relative">
                  <span
                    class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none"
                  >R$</span>
                  <input
                    v-model="novaCidade.custoKm"
                    type="text"
                    inputmode="decimal"
                    placeholder="0,00"
                    class="input-field pl-10"
                    @keydown.enter.prevent="adicionarCidade"
                  >
                </div>
              </div>
            </div>
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 bg-brand-blue text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-brand-blue-dark active:scale-95 transition-all"
              @click="adicionarCidade"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Adicionar Cidade
            </button>
          </div>
          <div v-if="form.cidadesAtendidas.length > 0" class="space-y-2">
            <p
              class="text-xs font-semibold uppercase tracking-wider text-gray-400"
            >
              Cidades cadastradas ({{ form.cidadesAtendidas.length }})
            </p>
            <TransitionGroup name="lista" tag="ul" class="space-y-2">
              <li
                v-for="(item, index) in form.cidadesAtendidas"
                :key="item.cidade + index"
                class="flex items-center justify-between bg-blue-50 border border-brand-blue/20 rounded-xl px-4 py-3"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <svg
                    class="w-4 h-4 text-brand-blue shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-800 truncate">
                      {{ item.cidade }}
                    </p>
                    <p v-if="item.custoKm" class="text-xs text-gray-500">
                      Deslocamento: R$ {{ item.custoKm }}
                    </p>
                    <p v-else class="text-xs text-gray-400">
                      Sem custo adicional informado
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="ml-3 shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 active:scale-90 transition-all"
                  aria-label="Remover cidade"
                  @click="removerCidade(index)"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            </TransitionGroup>
          </div>
          <div
            v-else
            class="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl"
          >
            Nenhuma cidade adicionada ainda.
          </div>
        </div>
      </section>

      <!-- ERRO GLOBAL -->
      <div
        v-if="submitError"
        class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3"
      >
        <svg
          class="w-5 h-5 text-red-500 shrink-0 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
        <p class="text-sm text-red-700">
          {{ submitError }}
        </p>
      </div>

      <!-- BOTÕES DE NAVEGAÇÃO -->
      <div
        class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-4 shadow-2xl md:relative md:border-0 md:shadow-none md:bg-transparent md:backdrop-blur-none md:px-0 md:py-0"
      >
        <div class="flex gap-3">
          <button
            v-if="stepAtual > 1"
            type="button"
            class="flex-1 border-2 border-brand-blue text-brand-blue font-bold py-4 rounded-xl text-base active:scale-[0.98] transition-all duration-200"
            @click="voltar"
          >
            ← Voltar
          </button>
          <button
            v-if="stepAtual < TOTAL_STEPS"
            type="button"
            class="flex-1 bg-brand-orange hover:bg-brand-orange-dark text-white font-bold py-4 rounded-xl text-base tracking-wide shadow-lg shadow-orange-200 active:scale-[0.98] transition-all duration-200"
            @click="avancar"
          >
            Próximo →
          </button>
          <button
            v-else
            type="submit"
            :disabled="isLoading"
            class="flex-1 bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base tracking-wide shadow-lg shadow-orange-200 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg
              v-if="isLoading"
              class="w-5 h-5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <svg
              v-else
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {{ isLoading ? "Enviando cadastro..." : "Enviar Cadastro" }}
          </button>
        </div>
        <p class="text-center text-xs text-gray-400 mt-2">
          Seus dados são protegidos e utilizados apenas pela 3CORE Tecnologia.
        </p>
      </div>
    </form>
  </div>
</template>

<style scoped>
@reference "../assets/css/main.css";

.label-field {
  @apply block text-sm font-medium text-gray-700 mb-1.5;
}

.input-field {
  @apply w-full px-3 py-3 border border-gray-200 rounded-xl text-sm text-gray-800
         bg-white placeholder-gray-400
         focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue
         transition-colors duration-200;
}

.msg-erro {
  @apply text-xs text-red-500 mt-1.5 flex items-center gap-1;
}

.msg-erro::before {
  content: "⚠";
}

.checkbox-card {
  @apply flex items-center gap-3 p-3 rounded-xl border-2 border-gray-100
         cursor-pointer select-none transition-all duration-150
         hover:border-gray-300 active:scale-[0.98];
}

.lista-enter-active,
.lista-leave-active {
  transition: all 0.25s ease;
}

.lista-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.lista-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
