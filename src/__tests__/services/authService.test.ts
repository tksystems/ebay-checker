import { AuthService } from '@/services/authService'
import { UserRole } from '@prisma/client'

// UserServiceをモック
jest.mock('@/services/userService', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    authenticateUser: jest.fn(),
    createUser: jest.fn(),
    findById: jest.fn(),
    updateUser: jest.fn(),
  })),
  userService: {
    authenticateUser: jest.fn(),
    createUser: jest.fn(),
    findById: jest.fn(),
    updateUser: jest.fn(),
  },
}))

import { userService } from '@/services/userService'

const mockUserService = userService as jest.Mocked<typeof userService>

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    authService = new AuthService()
    jest.clearAllMocks()
  })

  describe('authenticate', () => {
    it('should return success for valid credentials', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockUserService.authenticateUser.mockResolvedValue(mockUser)

      const result = await authService.authenticate({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result).toEqual({
        success: true,
        user: mockUser,
      })
      expect(mockUserService.authenticateUser).toHaveBeenCalledWith('test@example.com', 'password123')
    })

    it('should return error for missing credentials', async () => {
      const result = await authService.authenticate({
        email: '',
        password: '',
      })

      expect(result).toEqual({
        success: false,
        error: 'メールアドレスとパスワードは必須です',
      })
    })

    it('should return error for invalid credentials', async () => {
      mockUserService.authenticateUser.mockResolvedValue(null)

      const result = await authService.authenticate({
        email: 'test@example.com',
        password: 'wrongpassword',
      })

      expect(result).toEqual({
        success: false,
        error: 'メールアドレスまたはパスワードが正しくありません',
      })
    })

    it('should handle authentication errors', async () => {
      mockUserService.authenticateUser.mockRejectedValue(new Error('Database error'))

      const result = await authService.authenticate({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result).toEqual({
        success: false,
        error: '認証中にエラーが発生しました',
      })
    })
  })

  describe('register', () => {
    it('should register user successfully', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockUserService.createUser.mockResolvedValue(mockUser)

      const result = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result).toEqual({
        success: true,
        user: mockUser,
      })
      expect(mockUserService.createUser).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      })
    })

    it('should return error for missing required fields', async () => {
      const result = await authService.register({
        name: '',
        email: '',
        password: '',
      })

      expect(result).toEqual({
        success: false,
        error: '名前、メールアドレス、パスワードは必須です',
      })
    })

    it('should return error for invalid email format', async () => {
      const result = await authService.register({
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123',
      })

      expect(result).toEqual({
        success: false,
        error: '有効なメールアドレスを入力してください',
      })
    })

    it('should return error for weak password', async () => {
      const result = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: '123',
      })

      expect(result).toEqual({
        success: false,
        error: 'パスワードは8文字以上で入力してください',
      })
    })

    it('should handle registration errors', async () => {
      mockUserService.createUser.mockRejectedValue(new Error('Email already exists'))

      const result = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result).toEqual({
        success: false,
        error: 'Email already exists',
      })
    })
  })

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockUserService.findById.mockResolvedValue(mockUser)

      const result = await authService.getUserById('1')

      expect(result).toEqual(mockUser)
      expect(mockUserService.findById).toHaveBeenCalledWith('1')
    })

    it('should return null when user not found', async () => {
      mockUserService.findById.mockResolvedValue(null)

      const result = await authService.getUserById('nonexistent')

      expect(result).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      mockUserService.findById.mockRejectedValue(new Error('Database error'))

      const result = await authService.getUserById('1')

      expect(result).toBeNull()
    })
  })

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const mockUser = {
        id: '1',
        name: 'Updated User',
        email: 'test@example.com',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockUserService.updateUser.mockResolvedValue(mockUser)

      const result = await authService.updateUser('1', {
        name: 'Updated User',
      })

      expect(result).toEqual({
        success: true,
        user: mockUser,
      })
      expect(mockUserService.updateUser).toHaveBeenCalledWith('1', {
        name: 'Updated User',
      })
    })

    it('should handle update errors', async () => {
      mockUserService.updateUser.mockRejectedValue(new Error('Update failed'))

      const result = await authService.updateUser('1', {
        name: 'Updated User',
      })

      expect(result).toEqual({
        success: false,
        error: 'Update failed',
      })
    })
  })
})
