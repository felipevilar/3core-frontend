<script setup lang="ts">
import type { TechnicianDetail } from '~/types'

definePageMeta({ permission: 'tecnicos.ver' })

const route = useRoute()
const { $api } = useNuxtApp()

const { data: ficha, error } = await useAsyncData(
  `technician-${route.params.id}`,
  () => $api<TechnicianDetail>(`/technicians/${route.params.id}`)
)

function enderecoCompleto(f: TechnicianDetail) {
  const linha1 = [f.logradouro, f.numero].filter(Boolean).join(', ')
  const linha2 = [f.bairro, f.cidade, f.estado].filter(Boolean).join(' • ')
  return [linha1, f.complemento, linha2, f.cep ? `CEP ${f.cep}` : null]
    .filter(Boolean)
    .join('\n')
}

const tipoContaLabel: Record<string, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Conta poupança'
}
</script>

<template>
  <UDashboardPanel id="technician-detail">
    <template #header>
      <UDashboardNavbar :title="ficha?.user.name ?? 'Ficha do técnico'">
        <template #leading>
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            to="/technicians"
            aria-label="Voltar para técnicos"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="error" class="py-16 text-center text-sm text-muted">
        Técnico não encontrado.
      </div>

      <template v-else-if="ficha">
        <!-- Cabeçalho do técnico -->
        <div class="flex items-center gap-4 mb-6">
          <UAvatar :alt="ficha.user.name" size="xl" />
          <div>
            <h1 class="text-xl font-semibold text-highlighted flex items-center gap-2">
              {{ ficha.user.name }}
              <UBadge v-if="!ficha.user.isActive" color="neutral" variant="subtle" size="sm">
                inativo
              </UBadge>
            </h1>
            <p class="text-muted text-sm">{{ ficha.user.email }}</p>
            <p class="text-muted text-sm">{{ ficha.celular }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Dados pessoais -->
          <UPageCard title="Dados pessoais" variant="subtle">
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">CPF</dt>
                <dd class="text-highlighted text-right">{{ ficha.cpf || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">RG</dt>
                <dd class="text-highlighted text-right">{{ ficha.rg || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Celular</dt>
                <dd class="text-highlighted text-right">{{ ficha.celular || '—' }}</dd>
              </div>
            </dl>
          </UPageCard>

          <!-- Endereço -->
          <UPageCard title="Endereço" variant="subtle">
            <div class="text-sm">
              <p class="text-highlighted whitespace-pre-line">
                {{ enderecoCompleto(ficha) || '—' }}
              </p>
              <div v-if="ficha.enderecoEncomendas" class="mt-3 pt-3 border-t border-default">
                <p class="text-muted text-xs mb-0.5">Endereço para encomendas</p>
                <p class="text-highlighted">{{ ficha.enderecoEncomendas }}</p>
              </div>
            </div>
          </UPageCard>

          <!-- Financeiro -->
          <UPageCard title="Financeiro" variant="subtle">
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Pretensão (valor/hora)</dt>
                <dd class="text-highlighted text-right">
                  {{ ficha.pretensaoValorHora ? `R$ ${ficha.pretensaoValorHora}` : '—' }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Custo por km</dt>
                <dd class="text-highlighted text-right">
                  {{ ficha.custoPorKm ? `R$ ${ficha.custoPorKm}` : '—' }}
                </dd>
              </div>
            </dl>
          </UPageCard>

          <!-- Pagamento -->
          <UPageCard
            v-if="ficha.pagamento?.pix || ficha.pagamento?.dadosBancarios"
            title="Pagamento"
            variant="subtle"
          >
            <div class="space-y-3 text-sm">
              <div v-if="ficha.pagamento?.pix">
                <p class="text-muted text-xs mb-0.5">PIX</p>
                <p class="text-highlighted">{{ ficha.pagamento.pix.chavePix }}</p>
                <p class="text-dimmed text-xs">{{ ficha.pagamento.pix.nomeTitularPix }}</p>
              </div>
              <div v-if="ficha.pagamento?.dadosBancarios" :class="{ 'pt-3 border-t border-default': ficha.pagamento.pix }">
                <p class="text-muted text-xs mb-0.5">Dados bancários</p>
                <p class="text-highlighted">
                  {{ ficha.pagamento.dadosBancarios.banco }} •
                  Ag. {{ ficha.pagamento.dadosBancarios.agencia }} •
                  Cc. {{ ficha.pagamento.dadosBancarios.conta }}
                </p>
                <p class="text-dimmed text-xs">
                  {{ tipoContaLabel[ficha.pagamento.dadosBancarios.tipoConta] ?? ficha.pagamento.dadosBancarios.tipoConta }}
                </p>
              </div>
            </div>
          </UPageCard>

          <!-- Empresa -->
          <UPageCard v-if="ficha.empresa" title="Empresa" variant="subtle">
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Nome fantasia</dt>
                <dd class="text-highlighted text-right">{{ ficha.empresa.nomeFantasia || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Razão social</dt>
                <dd class="text-highlighted text-right">{{ ficha.empresa.razaoSocial || '—' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">CNPJ</dt>
                <dd class="text-highlighted text-right">{{ ficha.empresa.cnpj || '—' }}</dd>
              </div>
            </dl>
          </UPageCard>

          <!-- Áreas de atuação -->
          <UPageCard v-if="ficha.areasAtuacao?.length" title="Áreas de atuação" variant="subtle">
            <div class="flex flex-wrap gap-1.5">
              <UBadge
                v-for="area in ficha.areasAtuacao"
                :key="area"
                color="primary"
                variant="subtle"
              >
                {{ area }}
              </UBadge>
            </div>
          </UPageCard>

          <!-- Ferramental -->
          <UPageCard v-if="ficha.ferramental?.length" title="Ferramental" variant="subtle">
            <div class="flex flex-wrap gap-1.5">
              <UBadge
                v-for="tool in ficha.ferramental"
                :key="tool"
                color="neutral"
                variant="subtle"
              >
                {{ tool }}
              </UBadge>
            </div>
          </UPageCard>

          <!-- Cidades atendidas -->
          <UPageCard
            v-if="ficha.cidadesAtendidas?.length"
            title="Cidades atendidas"
            variant="subtle"
            class="lg:col-span-2"
          >
            <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
              <li
                v-for="(c, i) in ficha.cidadesAtendidas"
                :key="c.cidade + i"
                class="flex items-center justify-between gap-3 bg-default rounded-lg px-3 py-2"
              >
                <span class="text-highlighted font-medium">{{ c.cidade }}</span>
                <span class="text-muted text-xs shrink-0">
                  {{ c.custoKm ? `R$ ${c.custoKm}/km` : 'sem custo informado' }}
                </span>
              </li>
            </ul>
          </UPageCard>
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
