import type { AvatarProps } from '@nuxt/ui'

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'

export interface User {
  id: number
  name: string
  email: string
  avatar?: AvatarProps
  status: UserStatus
  location: string
}

export interface Mail {
  id: number
  unread?: boolean
  from: User
  subject: string
  body: string
  date: string
}

export interface Member {
  name: string
  username: string
  role: 'member' | 'owner'
  avatar: AvatarProps
}

// ---- RBAC / Auth ----
export interface AuthUser {
  id: number
  email: string
  name: string
  isActive: boolean
  role: { id: number, name: string, description: string | null }
  permissions: string[]
}

export interface Permission {
  key: string
  label: string
}

export interface PermissionGroup {
  feature: string
  label: string
  permissions: Permission[]
}

export interface Role {
  id: number
  name: string
  description: string | null
  isSystem: boolean
  permissions: Permission[]
}

export interface ManagedUser {
  id: number
  email: string
  name: string
  isActive: boolean
  role: Role
}

// ---- Técnicos ----
export interface CidadeAtendida {
  cidade: string
  custoKm: string
}

/** Linha enxuta retornada por GET /technicians (tabela). */
export interface TechnicianListItem {
  id: number
  userId: number
  name: string
  email: string
  isActive: boolean
  celular: string
  cidade: string | null
  estado: string | null
  areasAtuacao: string[] | null
  cidadesAtendidas: CidadeAtendida[] | null
  createdAt: string
}

export interface PagamentoInfo {
  pix?: { chavePix: string, nomeTitularPix: string } | null
  dadosBancarios?: {
    banco: string
    agencia: string
    conta: string
    tipoConta: string
  } | null
}

export interface EmpresaInfo {
  nomeFantasia: string
  razaoSocial: string
  cnpj: string
}

/** Ficha completa retornada por GET /technicians/:id. */
export interface TechnicianDetail {
  id: number
  userId: number
  cpf: string
  rg: string | null
  celular: string
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  enderecoEncomendas: string | null
  pretensaoValorHora: string | null
  custoPorKm: string | null
  pagamento: PagamentoInfo | null
  empresa: EmpresaInfo | null
  areasAtuacao: string[] | null
  ferramental: string[] | null
  cidadesAtendidas: CidadeAtendida[] | null
  createdAt: string
  updatedAt: string
  user: {
    id: number
    name: string
    email: string
    isActive: boolean
  }
}

export interface Stat {
  title: string
  icon: string
  value: number | string
  variation: number
  formatter?: (value: number) => string
}

export interface Sale {
  id: string
  date: string
  status: SaleStatus
  email: string
  amount: number
}

export interface Notification {
  id: number
  unread?: boolean
  sender: User
  body: string
  date: string
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}
