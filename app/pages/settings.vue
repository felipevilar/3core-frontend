<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { can } = usePermissions()

const links = computed<NavigationMenuItem[][]>(() => [[{
  label: 'Perfil',
  icon: 'i-lucide-user',
  to: '/settings',
  exact: true
}, ...(can('usuarios.ver')
  ? [{
      label: 'Usuários',
      icon: 'i-lucide-user-cog',
      to: '/settings/users'
    }]
  : []), ...(can('roles.ver')
  ? [{
      label: 'Permissões',
      icon: 'i-lucide-shield-check',
      to: '/settings/roles'
    }]
  : []), {
  label: 'Segurança',
  icon: 'i-lucide-shield',
  to: '/settings/security'
}]])
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Configurações">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
