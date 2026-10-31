# Security Policy

## 報告方法

脆弱性を見つけた場合は、公開 Issue や Pull Request に書かず、GitHub の **非公開の脆弱性報告** から送ってください。

1. このリポジトリの **Security** タブ → **Report a vulnerability** を開く
2. 影響するテンプレート・再現手順・影響範囲を書く。ログや設定を貼るときは、鍵・トークン・個人情報を消す

Banto 本体（描画の仕組み・レジ・会員など）の脆弱性は、[bantojs/banto の SECURITY.md](https://github.com/bantojs/banto/blob/main/SECURITY.md) の窓口へ送ってください。

> メンテナへ: この窓口を動かすには、GitHub の Settings → Code security → **Private vulnerability reporting** を有効にしてください。

## 対象

- このリポジトリの最新リリースと `main` ブランチのテーマのファイル（`layout`・`templates`・`sections`・`snippets`・`blocks`・`config`・`locales`・`assets`）

## 対象外

- フォークして手を入れたテーマ（変えた方が確かめてください）
- 運営者自身の Banto・Cloudflare・Supabase の設定
