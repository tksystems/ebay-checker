# eBay Store Monitor

eBayストアの出品リストを監視し、変化があった際に通知を送信するWebアプリケーションです。

## 概要

このアプリケーションは、指定されたeBayストアの出品リストを定期的に監視し、以下の機能を提供します：

- ユーザー登録・認証システム（admin/customer role）
- eBayストアの出品リスト監視
- 出品リストの変化を検知した際のメール・LINE通知
- Google Spreadsheet風の管理画面での売れた商品の閲覧

## 技術スタック

- **フロントエンド**: Next.js 15, TypeScript, Tailwind CSS
- **バックエンド**: Next.js API Routes
- **データベース**: Prisma ORM
- **認証**: NextAuth.js
- **通知**: Resend (メール), LINE Notify API
- **クローリング**: Playwright with Stealth Plugin (CLIスクリプト専用)
- **デプロイ**: AWS Amplify, Lightsail(クローラー用)

## アーキテクチャ

### Webアプリケーション (Next.js)
- ユーザー認証・管理
- ストア管理UI
- 商品一覧表示
- 通知設定

### クローリングシステム (CLIスクリプト)
- Playwrightを使用したeBayストアのクローリング
- バックグラウンドでの定期実行
- 商品データの収集・更新

## 主要機能

### 1. ユーザー管理
- ユーザー登録（名前、メールアドレス）
- ロールベースのアクセス制御（admin/customer）
- adminは全てのcustomerの状態を閲覧可能

### 2. eBayストア監視
- 指定されたeBayストアの出品リストを定期的にクローリング
- 重複監視の防止（複数サーバーでの実行時）
- クローリング情報のDB記録
- レート制限の実装

### 3. 通知システム
- 出品リストの変化検知時のメール通知（Resend）
- LINE通知機能
- 状況に応じた通知内容の調整

### 4. 管理画面
- Google Spreadsheet風のUI
- 売れた商品の一覧表示
- リアルタイムでのデータ更新

## セットアップ

### 前提条件
- Node.js 18以上
- npm または yarn
- データベース（MySQL8.0）

### インストール

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して必要な環境変数を設定

# データベースのセットアップ
npx prisma generate
npx prisma db push

# 開発サーバーの起動
npm run dev
```

### 環境変数

```env
# データベース
DATABASE_URL="mysql://username:password@localhost:5432/ebay_monitor"

# NextAuth.js
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Resend (メール通知)
RESEND_API_KEY="your-resend-api-key"

# LINE Notify
LINE_NOTIFY_TOKEN="your-line-notify-token"
```

## 使用方法

### ストア監視の開始

```bash
# ストア監視スクリプトの実行
npm run ebay:store:observe
```

このスクリプトは以下の処理を行います：
1. DBからストア情報を取得
2. 他の監視ツールが動作していないことを確認
3. クローラーを起動してストア情報を取得
4. 取得したデータをDBに記録

### 管理画面へのアクセス

1. ブラウザで `http://localhost:3000` にアクセス
2. ユーザー登録・ログイン
3. 管理画面で売れた商品を閲覧

## プロジェクト構造

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── admin/             # 管理画面
│   └── auth/              # 認証関連
├── components/            # React コンポーネント
├── lib/                   # ユーティリティ関数
├── prisma/                # Prisma スキーマ
└── scripts/               # クローリングスクリプト
```

## 開発

### データベースマイグレーション

```bash
# マイグレーションファイルの生成
npx prisma migrate dev --name migration_name

# データベースのリセット
npx prisma migrate reset
```

### テスト

```bash
# ユニットテスト
npm run test

# E2Eテスト
npm run test:e2e
```

## デプロイ
