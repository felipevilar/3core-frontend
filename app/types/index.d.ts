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
