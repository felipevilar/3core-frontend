<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({ permission: 'landing.ver' })

const links = [[{
  label: 'Áreas de Atuação',
  icon: 'i-lucide-briefcase',
  to: '/landing-config',
  exact: true
}, {
  label: 'Ferramental Técnico',
  icon: 'i-lucide-wrench',
  to: '/landing-config/tools'
}]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardPanel id="landing-config" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Landing Page">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <UNavigationMenu
          :items="links"
          highlight
          class="-mx-1 flex-1"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-6 w-full max-w-4xl mx-auto">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
