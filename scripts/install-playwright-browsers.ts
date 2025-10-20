#!/usr/bin/env tsx

/**
 * 本番サーバー用Playwrightブラウザインストールスクリプト
 * 本番環境でPlaywrightブラウザをインストールするためのヘルパースクリプト
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

class PlaywrightInstaller {
  private readonly isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Playwrightブラウザをインストール
   */
  async installBrowsers(): Promise<void> {
    console.log('🚀 Playwrightブラウザのインストールを開始します...');
    
    try {
      // システム依存関係のインストール（Linux環境用）
      if (this.isProduction) {
        console.log('📦 システム依存関係をインストール中...');
        try {
          execSync('npx playwright install-deps', { 
            stdio: 'inherit',
            timeout: 300000 // 5分のタイムアウト
          });
          console.log('✅ システム依存関係のインストールが完了しました');
        } catch (error) {
          console.warn('⚠️  システム依存関係のインストールに失敗しました（続行します）:', error);
        }
      }

      // Playwrightブラウザのインストール
      console.log('🌐 Playwrightブラウザをインストール中...');
      execSync('npx playwright install chromium', { 
        stdio: 'inherit',
        timeout: 600000 // 10分のタイムアウト
      });
      
      console.log('✅ Playwrightブラウザのインストールが完了しました');

      // インストール確認
      await this.verifyInstallation();

    } catch (error) {
      console.error('❌ Playwrightブラウザのインストールに失敗しました:', error);
      throw error;
    }
  }

  /**
   * インストールを確認
   */
  private async verifyInstallation(): Promise<void> {
    console.log('🔍 インストールを確認中...');
    
    try {
      // Playwrightのバージョン確認
      const version = execSync('npx playwright --version', { encoding: 'utf8' }).trim();
      console.log(`📋 Playwrightバージョン: ${version}`);

      // ブラウザの存在確認
      const playwrightPath = join(process.env.HOME || '/home/bitnami', '.cache/ms-playwright');
      if (existsSync(playwrightPath)) {
        console.log('✅ Playwrightキャッシュディレクトリが存在します');
      } else {
        console.warn('⚠️  Playwrightキャッシュディレクトリが見つかりません');
      }

      // 簡単なテスト実行
      console.log('🧪 ブラウザ起動テストを実行中...');
      execSync('npx playwright test --reporter=list --grep="basic"', { 
        stdio: 'pipe',
        timeout: 30000
      });
      
      console.log('✅ ブラウザ起動テストが成功しました');

    } catch (error) {
      console.error('❌ インストール確認に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 環境情報を表示
   */
  private displayEnvironmentInfo(): void {
    console.log('\n📊 環境情報:');
    console.log(`    OS: ${process.platform}`);
    console.log(`    Node.js: ${process.version}`);
    console.log(`    NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`    HOME: ${process.env.HOME || 'undefined'}`);
    console.log(`    USER: ${process.env.USER || 'undefined'}`);
    console.log(`    現在のディレクトリ: ${process.cwd()}`);
  }

  /**
   * メイン実行
   */
  async run(): Promise<void> {
    try {
      this.displayEnvironmentInfo();
      await this.installBrowsers();
      console.log('\n🎉 Playwrightブラウザのインストールが正常に完了しました！');
      console.log('これで ebay:store:observe コマンドが実行できるようになります。');
      
    } catch (error) {
      console.error('\n💥 インストールに失敗しました:', error);
      console.log('\n🔧 手動でインストールする場合:');
      console.log('   npm run playwright:install');
      console.log('   npm run playwright:install-deps');
      process.exit(1);
    }
  }
}

// メイン実行
async function main(): Promise<void> {
  const installer = new PlaywrightInstaller();
  await installer.run();
}

// スクリプトが直接実行された場合のみ実行
if (require.main === module) {
  main().catch((error) => {
    console.error('インストールスクリプトの実行に失敗しました:', error);
    process.exit(1);
  });
}

export { PlaywrightInstaller };
