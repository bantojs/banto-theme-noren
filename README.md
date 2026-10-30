# 暖簾（noren）

[Banto](https://github.com/bantojs/banto) の基礎テーマです。Liquid で書いた、速くて読みやすい出発点のテーマ（白×黒の無地）。
The reference Liquid theme for Banto — a fast, readable starting point.

> **無保証です。** このテーマは MIT ライセンスで、現状のまま提供します（[LICENSE](LICENSE)）。お店で使う前に、プレビューで確かめてください。
> テーマは外へ通信しません（分析のタグ・外のフォント・CDN を読み込みません）。

- Banto が Liquid で描けるページをすべて持っています（トップ・一覧・検索・商品・カート・レジ（配送先・最終確認）・購入の完了・法務・会員ページ・404）。
- スマホを先に作り、JS が無くても買えます（JS はページを移らずにカートに入れる・SKU を選び直したときに画像を並べ替える、の上乗せだけ）。
- 色・書体（端末のゴシック / 明朝）・幅・ロゴは、Banto の管理画面の「デザイン」→ 版の「設定」で変えられます。
- フォークして自分のテーマにする前提の素体です。

## 使える条件

Banto の Liquid のテーマが描かれる条件と同じです（Banto の [docs/themes.md「使える条件」](https://github.com/bantojs/banto/blob/main/docs/themes.md)）。

| 条件 | |
| --- | --- |
| Banto の版 | **v0.4.3 以上**を勧めます（CI はこの版で全ページを描いて確かめています）。v0.4.2 でも描けますが、カートのクーポンの欄と決済手段の選択は出ません |
| 動かす場所 | Cloudflare Workers の **有料プラン**（サイトの設定「Workers のプラン」）か Node。無料プランでは既定のテーマのままです |
| ショップ | **独自ドメイン**があること。独自ドメインの無いショップは既定のテーマのままです |
| 権限 | 取り込み・公開は、項目「デザイン（テーマ）」を持つ人か、AI 用トークンの `theme:write` / `theme:publish` |

## 取り込む

どの方法でも、取り込むのはこのリポジトリの直下のテーマのフォルダ（`layout`・`templates`・`sections`・`snippets`・`blocks`・`config`・`locales`・`assets`）です。`README.md`・`test/` などは送られません。

### 管理画面から（zip）

1. このリポジトリをダウンロードし、上のフォルダを zip にします（`zip -r noren.zip layout templates sections snippets blocks config locales assets`）。
2. Banto の管理画面 → ショップ → **デザイン** で zip を取り込みます。
3. 版の **プレビュー** で、カート・レジまで確かめてから **公開する** を押します。

### コマンドから（Banto の CLI）

Banto と同じ版の `cli/banto-theme.mjs` を使います（Node 20 以上、依存なし）。

```bash
curl -fsSLo banto-theme.mjs https://raw.githubusercontent.com/bantojs/banto/v0.4.3/cli/banto-theme.mjs
export BANTO_URL=https://banto.example.com   # 管理画面を開く URL
export BANTO_TOKEN=banto_...                 # AI 連携で発行した theme:write のトークン
node banto-theme.mjs push .                  # 新しい版として取り込み、プレビューのリンクを出す
node banto-theme.mjs push . --publish        # 取り込んで公開する（theme:publish も要る）
```

### GitHub Actions から

フォークしたリポジトリで、プルリクエストでプレビュー・`main` への push で公開する例が Banto の [examples/theme-github-actions/](https://github.com/bantojs/banto/tree/main/examples/theme-github-actions) にあります。

## 自分のテーマにする

1. このリポジトリをフォークします（または「Use this template」で写します）。
2. 名前を変えます: `config/settings_schema.json` の `theme_info`（`theme_name`・`theme_author`・`theme_documentation_url`）。
3. ロゴやメイン画像を使うなら、画像を `assets/` に置きます。設定の「ロゴの画像」「メイン画像」は `assets/` の画像から選びます（Banto の設定の画面には画像を上げる欄がありません）。`assets/` に SVG と HTML は置けません。
4. 見た目は `assets/noren.css` と、各セクションの Liquid を直します。色・文字の大きさ・幅は CSS の変数（`--color-*`・`--font-*`・`--page-width`）で、値はテーマの設定から `layout/theme.liquid` が入れます。
5. `test/render.test.ts` を回して、すべてのページが描けることを確かめます（下の「確かめる」）。

## テーマの中身

| 置き場 | 中身 |
| --- | --- |
| `layout/theme.liquid` | 外枠。`{{ content_for_header }}` と `{{ content_for_layout }}`、ヘッダー・フッターは `{% sections 'header-group' %}` / `'footer-group'` |
| `templates/*.json` | トップ・一覧・検索・商品・カート・法務・404 のセクションの並び（管理画面で並べ替え・足す・外すができる） |
| `templates/checkout.liquid` | レジの配送先。`{% form 'checkout_address' %}` と Banto の欄の名前 |
| `templates/checkout_confirm.liquid` | レジの最終確認。特定商取引法の表示と「注文を確定する」は `{% banto_confirmation %}`（Banto の部品。必須） |
| `templates/checkout_done.liquid` | 購入の完了（`checkout.status` ごと） |
| `templates/customers/account.liquid` | 会員ページ。住所・ログインの方法・退会などは `{% banto_account %}`（Banto の部品） |
| `sections/` | ヘッダー・フッター・お知らせの帯・メイン画像・文章・おすすめの商品・各ページの本体（`main-*`） |
| `blocks/` | テーマのブロック（`text`・`button`）。`sections/rich-text.liquid` が `{% content_for 'blocks' %}` で並べる見本 |
| `snippets/` | 商品カード・値段・画像（本画像とサムネイルの `srcset`）・ページ送り・メニュー・レジの入力欄 |
| `config/` | テーマの設定の宣言（色・書体・幅・ロゴ・カート）と既定の値 |
| `locales/` | 日本語（既定）と英語。設定の画面の文言は `*.schema.json` |
| `assets/` | `noren.css` と `noren.js` の 2 つだけ |

名前（テンプレート・セクション・フィルター・オブジェクト・タグ）は、Shopify のテーマを書いたことのある人がそのまま書けるように Banto が合わせたものです。このテーマは一から書いたもので、Shopify のテーマのコードは含みません。

## 決まりごと（Banto のテーマとして）

- 出力は既定でエスケープされます。生の HTML は `| raw`（このテーマでは `<style>` の中の書体の並びだけ）。
- **レジ（配送先・最終確認）と会員ページには CSP（`script-src 'self'`）が付きます。** インラインのスクリプトは動かないので、JS はすべて `assets/noren.js` に置いています。ほかのページも同じにしておくと迷いません。
- 金額は 100 倍の整数で、`| money` で円にします。画像は本画像（長辺 1600px）とサムネイル（長辺 400px）の 2 つだけで、`image_url: width:` が 400 以下ならサムネイルです。
- 一覧の商品の `available` は「値段のついた SKU があるか」で、在庫の有無は商品のページでだけ分かります。在庫の数は渡りません。
- `{% render %}` で呼ぶ snippet の中では、`settings`・`routes`・`shop` などのどのページでも渡る値は見えますが、ページだけの値（`product` など）と親で `assign` した値は見えません（Shopify と同じ）。引数で渡します（例: `{% render 'menu-list', links: menu.links %}`）。
- カートのクーポンの欄は、クーポンのモジュールが ON のショップ（`routes.cart_coupon_url` があるとき）だけに出ます。決済手段を選ぶ欄は、使える決済手段が 2 つ以上のとき（`cart.banto_payment_methods`）だけに出ます。KOMOJU の中の支払い方法（コンビニ・銀行振込など）は KOMOJU のページで選びます。
- テーマで描かないページ（会員のログイン・注文照会・お問い合わせ・送料）は Banto の既定のテーマのままです。見た目をそろえたいときは、ショップの設定の色・ロゴを合わせてください。

## 確かめる

CI（`.github/workflows/ci.yml`）は、Banto を決めた版で取ってきて、Banto のテストの道具でこのテーマの全ページを描きます（取り込みの検査・テンプレートの誤りが無いこと・カートのクーポンの欄・最終確認の部品・レジの CSP・決済ページまで進めること）。手元では:

```bash
git clone https://github.com/bantojs/banto ../banto && (cd ../banto && git checkout v0.4.3 && npm ci)
cp test/render.test.ts ../banto/test/noren-render.test.ts
(cd ../banto && NOREN_DIR=../banto-theme-noren npx vitest run test/noren-render.test.ts)
```

## ライセンス

MIT（[LICENSE](LICENSE)）。脆弱性の報告は [SECURITY.md](SECURITY.md)。
