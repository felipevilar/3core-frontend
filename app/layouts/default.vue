<script setup lang="ts">
import type { CommandPaletteItem, NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const toast = useToast()
const { can } = usePermissions()

const open = ref(false)

// Item de menu com permissão opcional. Itens/grupos sem permissão são sempre visíveis;
// com permissão, só aparecem se o usuário a possuir (children filtrados recursivamente).
type AppNavItem = NavigationMenuItem & {
  permission?: string
  children?: AppNavItem[]
}

const allLinks: AppNavItem[][] = [[{
  label: 'Início',
  icon: 'i-lucide-house',
  to: '/dashboard',
  permission: 'dashboard.ver',
  onSelect: () => {
    open.value = false
  }
},
{
  label: 'Técnicos',
  icon: 'i-lucide-hard-hat',
  to: '/technicians',
  permission: 'tecnicos.ver',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Clientes',
  icon: 'i-lucide-building-2',
  to: '/clientes',
  permission: 'clientes.ver',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Atendimentos',
  icon: 'i-lucide-clipboard-list',
  to: '/chamados',
  permission: 'atendimentos.ver',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Financeiro',
  icon: 'i-lucide-wallet',
  to: '/financeiro',
  permission: 'financeiro.ver',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Meus Ganhos',
  icon: 'i-lucide-hand-coins',
  to: '/financeiro/meus-ganhos',
  permission: 'financeiro.ver_proprio',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Landing Page',
  icon: 'i-lucide-layout-template',
  to: '/landing-config',
  type: 'trigger',
  defaultOpen: false,
  permission: 'landing.ver',
  children: [{
    label: 'Áreas de Atuação',
    to: '/landing-config',
    exact: true,
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Ferramental Técnico',
    to: '/landing-config/tools',
    onSelect: () => {
      open.value = false
    }
  }]
}, {
  label: 'Configurações',
  to: '/settings',
  icon: 'i-lucide-settings',
  defaultOpen: false,
  type: 'trigger',
  children: [{
    label: 'Perfil',
    to: '/settings',
    exact: true,
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Usuários',
    to: '/settings/users',
    permission: 'usuarios.ver',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Permissões',
    to: '/settings/roles',
    permission: 'roles.ver',
    onSelect: () => {
      open.value = false
    }
  }, {
    label: 'Segurança',
    to: '/settings/security',
    onSelect: () => {
      open.value = false
    }
  }]
}]
//   [{
//   label: 'Feedback',
//   icon: 'i-lucide-message-circle',
//   to: 'https://github.com/nuxt-ui-templates/dashboard',
//   target: '_blank'
// }, {
//   label: 'Help & Support',
//   icon: 'i-lucide-info',
//   to: 'https://github.com/nuxt-ui-templates/dashboard',
//   target: '_blank'
// }
// ]
]

// Filtra um item pela sua permissão e recursivamente seus children;
// um grupo (trigger) é removido se todos os seus children forem filtrados.
function filterItems(items: AppNavItem[]): NavigationMenuItem[] {
  return items
    .filter(item => !item.permission || can(item.permission))
    .map((item) => {
      if (!item.children) return item
      const children = filterItems(item.children)
      return { ...item, children }
    })
    .filter(item => !item.children || item.children.length > 0) as NavigationMenuItem[]
}

const links = computed<NavigationMenuItem[][]>(() => allLinks.map(filterItems))

const groups = computed(() => [{
  id: 'links',
  label: 'Ir para',
  // cast: NavigationMenuItem é compatível com CommandPaletteItem em runtime
  items: links.value.flat() as unknown as CommandPaletteItem[]
}, {
  id: 'code',
  label: 'Código',
  items: [{
    id: 'source',
    label: 'Ver código-fonte da página',
    icon: 'i-simple-icons-github',
    to: `https://github.com/nuxt-ui-templates/dashboard/blob/main/app/pages${route.path === '/' ? '/index' : route.path}.vue`,
    target: '_blank'
  }]
}])

onMounted(async () => {
  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }

  toast.add({
    title: 'Usamos cookies próprios para melhorar sua experiência em nosso site.',
    duration: 0,
    close: false,
    actions: [{
      label: 'Aceitar',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: 'Recusar',
      color: 'neutral',
      variant: 'ghost'
    }]
  })
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[1]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
        <!-- links é computed; o acesso por índice funciona normalmente no template -->
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />

    <NotificationsSlideover />
  </UDashboardGroup>
</template>
