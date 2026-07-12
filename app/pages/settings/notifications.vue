<script setup lang="ts">
const state = reactive<{ [key: string]: boolean }>({
  email: true,
  desktop: false,
  product_updates: true,
  weekly_digest: false,
  important_updates: true
})

const sections = [{
  title: 'Canais de notificação',
  description: 'Por onde podemos notificá-lo?',
  fields: [{
    name: 'email',
    label: 'E-mail',
    description: 'Receba um resumo diário por e-mail.'
  }, {
    name: 'desktop',
    label: 'Desktop',
    description: 'Receba notificações no desktop.'
  }]
}, {
  title: 'Atualizações da conta',
  description: 'Receba atualizações sobre o sistema.',
  fields: [{
    name: 'weekly_digest',
    label: 'Resumo semanal',
    description: 'Receba um resumo semanal de novidades.'
  }, {
    name: 'product_updates',
    label: 'Atualizações do produto',
    description: 'Receba um e-mail mensal com todos os novos recursos e atualizações.'
  }, {
    name: 'important_updates',
    label: 'Atualizações importantes',
    description: 'Receba e-mails sobre atualizações importantes como correções de segurança, manutenção, etc.'
  }]
}]

async function onChange() {
  // Do something with data
  console.log(state)
}
</script>

<template>
  <div v-for="(section, index) in sections" :key="index">
    <UPageCard
      :title="section.title"
      :description="section.description"
      variant="naked"
      class="mb-4"
    />

    <UPageCard variant="subtle" :ui="{ container: 'divide-y divide-default' }">
      <UFormField
        v-for="field in section.fields"
        :key="field.name"
        :name="field.name"
        :label="field.label"
        :description="field.description"
        class="flex items-center justify-between not-last:pb-4 gap-2"
      >
        <USwitch
          v-model="state[field.name]"
          @update:model-value="onChange"
        />
      </UFormField>
    </UPageCard>
  </div>
</template>
