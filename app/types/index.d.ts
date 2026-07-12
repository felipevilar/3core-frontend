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

// ---- Cidades (IBGE) ----
export interface City {
  code: number
  nome: string
  searchName: string
  uf: string
  ufNome: string
  regiao: string
  lat: number | null
  lng: number | null
  capital: boolean
}

/** Município resumido (autocomplete e listas). */
export interface CityRef {
  code: number
  nome: string
  uf: string
}

export interface Uf {
  uf: string
  ufNome: string
  regiao: string
}

// ---- Técnicos ----
/** Cidade atendida, já resolvida com custo em R$/km. */
export interface ServedCity {
  code: number
  nome: string
  uf: string
  custoKm?: string | null
}

/** Linha enxuta retornada por GET /technicians (tabela). */
export interface TechnicianListItem {
  id: number
  userId: number
  name: string
  email: string
  isActive: boolean
  celular: string
  cityCode: number | null
  cidadeNome: string | null
  uf: string | null
  areasAtuacao: string[] | null
  cidadesAtendidas: CityRef[]
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

/** Item de tech_service_areas expandido (relação servedCities). */
export interface TechServiceArea {
  id: number
  cityCode: number
  custoKm: string | null
  city: CityRef
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
  cityCode: number | null
  city: City | null
  enderecoEncomendas: string | null
  pretensaoValorHora: string | null
  custoPorKm: string | null
  pagamento: PagamentoInfo | null
  empresa: EmpresaInfo | null
  areasAtuacao: string[] | null
  ferramental: string[] | null
  servedCities: TechServiceArea[]
  createdAt: string
  updatedAt: string
  user: {
    id: number
    name: string
    email: string
    isActive: boolean
  }
}

// ---- Clientes ----
export type ClientType = 'pf' | 'pj'

export interface Client {
  id: number
  tipo: ClientType
  nome: string
  nomeFantasia: string | null
  cnpj: string | null
  cpf: string | null
  email: string | null
  telefone: string | null
  contatoNome: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cityCode: number | null
  city: City | null
  observacoes: string | null
  ativo: boolean
  createdAt: string
  updatedAt: string
}

/** Corpo aceito por POST /clients e PATCH /clients/:id. */
export interface ClientPayload {
  tipo: ClientType
  nome: string
  nomeFantasia?: string | null
  cnpj?: string | null
  cpf?: string | null
  email?: string | null
  telefone?: string | null
  contatoNome?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cityCode?: number | null
  observacoes?: string | null
  ativo?: boolean
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
