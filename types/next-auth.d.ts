import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      status: string
      adminId?: string
      assignedPhoneNumber?: string
      assignedEmailId?: string
      assignedEmail?: {
        id: string
        emailAddress: string
        displayName: string
      }
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: string
    status: string
    adminId?: string
    assignedPhoneNumber?: string
    assignedEmailId?: string
    assignedEmail?: {
      id: string
      emailAddress: string
      displayName: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    status: string
    adminId?: string
    assignedPhoneNumber?: string
    assignedEmailId?: string
    assignedEmail?: {
      id: string
      emailAddress: string
      displayName: string
    }
  }
}
