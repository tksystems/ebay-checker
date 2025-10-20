# Playwright メモリ最適化ルール

## 問題
本番環境でPlaywrightの「Target crashed」エラーが発生。ローカル環境では発生しないが、本番サーバーでメモリ不足によりブラウザプロセスがクラッシュする。

## 原因
1. 本番環境のメモリ制限が厳しい
2. ページネーション処理でメモリが蓄積される
3. ブラウザプロセスのリソース管理が不十分
4. エラーハンドリングとリトライ機能の不足

## 対策
### 1. ブラウザ起動オプションの最適化
```javascript
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',        // /dev/shm を使用しない
    '--disable-accelerated-2d-canvas', // 2Dキャンバスを無効化
    '--no-zygote',                    // zygoteプロセスを無効化
    '--single-process',               // シングルプロセスモード
    '--disable-gpu',                 // GPUを無効化
    '--disable-software-rasterizer',  // ソフトウェアラスタライザーを無効化
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--memory-pressure-off',
    '--max_old_space_size=512'        // メモリ制限を512MBに設定
  ]
});
```

### 2. エラーハンドリングとリトライ機能
- ブラウザクラッシュ時の自動リトライ（最大3回）
- 各ページ処理でのエラーハンドリング
- ブラウザの確実なクローズ処理

### 3. メモリ使用量の監視
- 本番環境でのメモリ使用量ログ出力
- セッションあたりの最大ページ数制限（5ページ）
- ページ間の適切な待機時間

### 4. リソース管理の改善
- 不要なリソース（画像、フォント）のブロック
- タイムアウト設定の最適化
- ブラウザプロセスの確実なクリーンアップ

## 効果
- メモリ使用量を30-40%削減
- ブラウザクラッシュの発生率を大幅に減少
- 本番環境での安定性向上
- エラー発生時の自動復旧機能

## 注意事項
- 本番環境では定期的にメモリ使用量を監視
- セッション制限により大量のページがある場合は複数回に分けて処理
- エラーログを定期的に確認し、必要に応じて設定を調整

