import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { authService } from "@/services/authService"

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const result = await authService.authenticate({
          email: credentials.email,
          password: credentials.password
        })

        if (!result.success || !result.user) {
          return null
        }

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        }
      }
    })
  ],
        session: {
          strategy: "jwt" as const
        },
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async jwt({ token, user }: { token: any; user: any }) {
            if (user) {
              token.role = (user as { role?: string }).role
            }
            return token
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async session({ session, token }: { session: any; token: any }) {
            if (token) {
              (session.user as { role?: string }).role = token.role
            }
            return session
          }
        },
  pages: {
    signIn: "/login"
  }
}
