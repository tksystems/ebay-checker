import { test, expect } from '@playwright/test'

test.describe('Basic Page Tests', () => {
  test('basic page load test', async ({ page }) => {
    // ホームページにアクセス
    await page.goto('/')
    
    // ページタイトルを確認
    await expect(page).toHaveTitle(/eBay Checker/)
    
    // ページが正常に読み込まれることを確認
    await expect(page.locator('body')).toBeVisible()
  })

  test('register page accessibility', async ({ page }) => {
    // 登録ページにアクセス
    await page.goto('/register')
    
    // ページタイトルを確認
    await expect(page).toHaveTitle(/eBay Checker/)
    
    // 登録フォームの要素が存在することを確認
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('login page accessibility', async ({ page }) => {
    // ログインページにアクセス
    await page.goto('/login')
    
    // ページタイトルを確認
    await expect(page).toHaveTitle(/eBay Checker/)
    
    // ログインフォームの要素が存在することを確認
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('dashboard page accessibility', async ({ page }) => {
    // ダッシュボードページにアクセス
    await page.goto('/dashboard')
    
    // ページタイトルを確認
    await expect(page).toHaveTitle(/eBay Checker/)
    
    // ページが正常に読み込まれることを確認
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('User Registration Flow', () => {
  test('should have registration form elements', async ({ page }) => {
    await page.goto('/register')
    
    // フォーム要素が存在することを確認
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should have login form elements', async ({ page }) => {
    await page.goto('/login')
    
    // ログインフォーム要素が存在することを確認
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })
})
