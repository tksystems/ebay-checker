// 基本的なJestの動作確認テスト
describe('Basic Jest Test', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle async operations', async () => {
    const promise = Promise.resolve('test')
    await expect(promise).resolves.toBe('test')
  })

  it('should handle string operations', () => {
    const str = 'Hello World'
    expect(str).toContain('World')
    expect(str.length).toBeGreaterThan(0)
  })
})
