import { UserService, CreateUserData } from '@/services/userService'
import { UserRole } from '@prisma/client'

// Prismaクライアントをモック
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notificationSettings: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

// bcryptjsをモック
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>

describe('UserService', () => {
  let userService: UserService

  beforeEach(() => {
    userService = new UserService()
    jest.clearAllMocks()
  })

  describe('findByEmail', () => {
    it('should return user when email exists', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await userService.findByEmail('test@example.com')

      expect(result).toEqual(mockUser)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      })
    })

    it('should return null when email does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await userService.findByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })
  })

  describe('isEmailExists', () => {
    it('should return true when email exists', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await userService.isEmailExists('test@example.com')

      expect(result).toBe(true)
    })

    it('should return false when email does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await userService.isEmailExists('nonexistent@example.com')

      expect(result).toBe(false)
    })
  })

  describe('verifyPassword', () => {
    it('should return true for valid password', async () => {
      mockBcrypt.compare.mockResolvedValue(true)

      const result = await userService.verifyPassword('password', 'hashedPassword')

      expect(result).toBe(true)
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password', 'hashedPassword')
    })

    it('should return false for invalid password', async () => {
      mockBcrypt.compare.mockResolvedValue(false)

      const result = await userService.verifyPassword('wrongpassword', 'hashedPassword')

      expect(result).toBe(false)
    })
  })

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const userData: CreateUserData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: UserRole.CUSTOMER,
      }

      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.user.findUnique.mockResolvedValue(null) // メールアドレスが存在しない
      mockBcrypt.hash.mockResolvedValue('hashedPassword')
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          notificationSettings: {
            create: jest.fn().mockResolvedValue({}),
          },
        })
      })

      const result = await userService.createUser(userData)

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      })
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12)
    })

    it('should throw error when email already exists', async () => {
      const userData: CreateUserData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      }

      const existingUser = {
        id: '1',
        name: 'Existing User',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.user.findUnique.mockResolvedValue(existingUser)

      await expect(userService.createUser(userData)).rejects.toThrow(
        'このメールアドレスは既に使用されています'
      )
    })
  })

  describe('authenticateUser', () => {
    it('should return user for valid credentials', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockBcrypt.compare.mockResolvedValue(true)

      const result = await userService.authenticateUser('test@example.com', 'password')

      expect(result).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      })
    })

    it('should return null for invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await userService.authenticateUser('test@example.com', 'password')

      expect(result).toBeNull()
    })

    it('should return null for invalid password', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedPassword',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockBcrypt.compare.mockResolvedValue(false)

      const result = await userService.authenticateUser('test@example.com', 'wrongpassword')

      expect(result).toBeNull()
    })
  })
})
