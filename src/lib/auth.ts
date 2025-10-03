import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

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

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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
