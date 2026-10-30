/**
 * 暖簾を Banto で描いて確かめる（CI の「Banto を借りて描く」）。
 *
 * このファイルは Banto のリポジトリの test/ に写して、Banto の vitest で動かす（Banto のテストの道具を使うため）。
 * テーマの場所は環境変数 NOREN_DIR。手元では:
 *   cp test/render.test.ts ../banto/test/noren-render.test.ts
 *   (cd ../banto && NOREN_DIR=../banto-theme-noren npx vitest run test/noren-render.test.ts)
 *
 * 確かめること:
 * - 取り込みの検査（checkThemeBundle）が通る（ja と en）
 * - すべてのページがテーマで描かれる（既定のテーマに戻っていない）
 * - 管理画面のプレビューで描いて、テンプレートの誤り（theme-error）が出ない
 * - 最終確認に {% banto_confirmation %}、レジと会員ページに CSP、決済ページまで進める
 */
import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { FakeSupabase } from "./fake-supabase";
import { FakeStripe } from "./fake-stripe";
import { ADDRESS, BASE, Browser, MemoryStorage, appWith, memberLogin, memberMail, quoteFrom } from "./helpers";
import { forgetThemes } from "../src/themes/liquid/cache";
import { checkThemeBundle } from "../src/themes/liquid/bundle";
import { extendShopify } from "../src/themes/liquid/shopify";
import { sealThemePreview } from "../src/themes/liquid/preview";
import { CHECKOUT_CSP } from "../src/routes/storefront/liquid";
// @ts-expect-error 型の無い .mjs（Banto の CLI。束ね方を CLI と同じにする）
import { buildBundle } from "../cli/banto-theme.mjs";

const DIR = resolve(process.env["NOREN_DIR"] ?? "../banto-theme-noren");
const DOMAIN = "https://shop.example.jp";
const VERSION = "0e0e0e0e-0000-4000-8000-000000000001";

interface Bundle {
  format: 1;
  files: Record<string, string>;
  assets: string[];
}
let bundle: Bundle;

beforeAll(async () => {
  bundle = ((await buildBundle(DIR, "ja")) as { bundle: Bundle }).bundle;
});

async function setup() {
  forgetThemes();
  const sb = new FakeSupabase();
  sb.sitePlan = "paid";
  const owner = sb.addUser("owner@example.com", "password-123", { owner: true });
  const shop = sb.addShop(owner.id, {
    slug: "noren",
    name: "暖簾の見本のお店",
    published: true,
    legal_notice: "販売業者: 見本商店\n所在地: 東京都",
    privacy_policy: "個人情報の扱い",
    return_policy: "返品について",
    stripe_account_id: "acct_connected",
    settings: { members_enabled: true, theme_settings: { description: "白と黒の見本のお店です。" } },
  });
  const row = sb.tables.shops.find((x) => x["id"] === shop.id)!;
  row["domain"] = "shop.example.jp";
  row["theme_public"] = { id: VERSION, storage_key: `themes/${shop.id}/${VERSION}/bundle.json`, settings: {} };

  const tops = sb.addCategory(shop.id, { slug: "tops", name: "トップス" });
  sb.addCategory(shop.id, { slug: "tee", name: "Tシャツ", parent_id: tops.id });
  const tee = sb.addProduct(shop.id, { slug: "tee", name: "無地のTシャツ", description: "綿 100%。\n洗えます。", published: true, category_id: tops.id, tags: ["定番"], brand: "暖簾" });
  const skuS = sb.addSku(shop.id, tee.id, { code: "TEE-W-S", price_jpy: 3300, compare_at_price_jpy: 4400, options: { カラー: "白", サイズ: "S" }, available: 5 });
  sb.addSku(shop.id, tee.id, { code: "TEE-W-M", price_jpy: 3300, options: { カラー: "白", サイズ: "M" }, available: 0 });
  sb.addSku(shop.id, tee.id, { code: "TEE-B-M", price_jpy: 3500, options: { カラー: "黒", サイズ: "M" }, available: 2 });
  sb.tables.product_images.push(
    { id: "img-1", shop_id: shop.id, product_id: tee.id, storage_key: "p/tee-w.webp", thumb_key: "p/tee-w-400.webp", width: 1600, height: 1600, sort_order: 0, options: { カラー: "白" } },
    { id: "img-2", shop_id: shop.id, product_id: tee.id, storage_key: "p/tee-b.webp", thumb_key: "p/tee-b-400.webp", width: 1600, height: 1600, sort_order: 1, options: { カラー: "黒" } },
  );
  const bag = sb.addProduct(shop.id, { slug: "bag", name: "帆布のかばん", published: true });
  sb.addSku(shop.id, bag.id, { code: "BAG", price_jpy: 5500, available: 3 });

  const storage = new MemoryStorage(`${BASE}/media`);
  await storage.put(`themes/${shop.id}/${VERSION}/bundle.json`, new TextEncoder().encode(JSON.stringify(bundle)).buffer as ArrayBuffer, "application/json");
  const mail = memberMail(sb, shop.id);
  const app = appWith(sb, { RESEND_API_KEY: "re_test" }, storage, new FakeStripe());
  const b = new Browser(app, DOMAIN);
  return { sb, shop, b, mail, skuS };
}

/** 管理画面のプレビュー（切り離さない券）で開く。テンプレートの誤りがその場所に赤く出る */
async function preview(b: Browser, shopId: string) {
  const token = await sealThemePreview("test-session-secret", shopId, VERSION, "admin");
  const res = await b.get(`/?preview_theme=${VERSION}&preview_token=${encodeURIComponent(token)}`);
  expect(res.status).toBe(200);
}

/** テーマで描けたページか（既定のテーマに戻っていない・誤りが無い） */
function expectNoren(html: string, template: string) {
  expect(html, `template ${template}`).toContain(`class="noren template-${template}"`);
  expect(html).not.toContain("theme-error");
  expect(html).not.toContain("translation missing");
  expect(html).toContain("<!-- banto:head -->");
}

describe("取り込みの検査", () => {
  it("Banto の検査が通る（ja・en）", async () => {
    const ja = checkThemeBundle(bundle, { extend: extendShopify });
    expect(ja.errors).toEqual([]);
    const en = ((await buildBundle(DIR, "en")) as { bundle: Bundle }).bundle;
    expect(checkThemeBundle(en, { extend: extendShopify }).errors).toEqual([]);
    expect(bundle.assets).toEqual(expect.arrayContaining(["noren.css", "noren.js"]));
  });
});

describe("すべてのページをテーマで描く", () => {
  it("トップ・カテゴリー・タグ・検索・商品・法務・404", async () => {
    const { b, shop } = await setup();
    await preview(b, shop.id);

    const top = await (await b.get("/")).text();
    expectNoren(top, "index");
    expect(top).toContain("暖簾の見本のお店");
    expect(top).toContain("白と黒の見本のお店です。");
    expect(top).toContain('href="/p/tee"');
    expect(top).toContain("¥3,300");

    const cat = await (await b.get("/?category=tops")).text();
    expectNoren(cat, "collection");
    expect(cat).toContain("<h1 class=\"collection__title\">トップス</h1>");

    expectNoren(await (await b.get("/?tag=%E5%AE%9A%E7%95%AA")).text(), "collection");

    const search = await (await b.get("/search?q=%E3%81%8B%E3%81%B0%E3%82%93")).text();
    expectNoren(search, "search");
    const short = await (await b.get("/search?q=ab")).text();
    expectNoren(short, "search");
    expect(short).toContain("3 文字以上で探してください。");

    const product = await (await b.get("/p/tee")).text();
    expectNoren(product, "product");
    expect(product).toContain('<form method="post" action="/cart/add"');
    expect(product).toContain("<s class=\"price__compare\">¥4,400</s>");
    expect(product).toMatch(/<option\s+value="[^"]+"\s+data-sku="TEE-W-M"[^>]*disabled/);

    // SKU を選び直したときに JS が使うセクションだけの描画（?sku= で画像の並びが変わる）
    const section = await (await b.get("/p/tee?sku=TEE-B-M&section_id=main")).text();
    expect(section).toContain('id="shopify-section-main"');
    expect(section.indexOf("tee-b")).toBeLessThan(section.indexOf("tee-w"));

    for (const [path, title] of [
      ["/legal", "特定商取引法に基づく表記"],
      ["/privacy", "プライバシーポリシー"],
      ["/returns", "返品"],
    ] as const) {
      const html = await (await b.get(path)).text();
      expectNoren(html, "page");
      expect(html).toContain(title);
    }

    const nf = await b.get("/p/no-such-product");
    expect(nf.status).toBe(404);
    expectNoren(await nf.text(), "404");
  });

  it("カート → 配送先 → 最終確認 → 決済ページ → 完了", async () => {
    const { b, shop, skuS } = await setup();
    await preview(b, shop.id);

    const empty = await (await b.get("/cart")).text();
    expectNoren(empty, "cart");
    expect(empty).toContain("カートは空です。");

    // ページを移らずに入れる（noren.js と同じ送り方）。ヘッダーを描き直して返す
    const added = await b.postJson("/cart/add", { id: skuS.id, quantity: 2, sections: "header" });
    expect(added.status).toBe(200);
    const json = (await added.json()) as { sections?: Record<string, string> };
    expect(json.sections?.["header"]).toContain('data-noren-cart-count>2</span>');

    const cart = await (await b.get("/cart")).text();
    expectNoren(cart, "cart");
    expect(cart).toContain('name="updates[]" value="2"');
    expect(cart).toContain("¥6,600");

    // カートのフォームの「購入手続きへ」→ 配送先（テーマのレジ）
    const address = await b.post("/cart", { "updates[]": "2", checkout: "" });
    expect(address.status).toBe(200);
    expect(address.headers.get("content-security-policy")).toBe(CHECKOUT_CSP);
    const addressHtml = await address.text();
    expectNoren(addressHtml, "checkout");
    expect(addressHtml).toContain('<form method="post" action="/checkout/stripe"');
    expect(addressHtml).toContain('<option value="北海道"');
    expect(addressHtml).not.toMatch(/<script>(?!<\/script>)/);

    // 誤りは同じ画面で
    const bad = await b.post("/checkout/stripe", { ...ADDRESS, customer_email: "not-an-email" });
    expect(bad.status).toBe(400);
    const badHtml = await bad.text();
    expectNoren(badHtml, "checkout");
    expect(badHtml).toContain('role="alert"');
    expect(badHtml).toContain(`value="${ADDRESS.customer_name}"`);

    // 最終確認: テーマの外側の中に Banto の部品
    const review = await b.post("/checkout/stripe", ADDRESS);
    expect(review.status).toBe(200);
    expect(review.headers.get("content-security-policy")).toBe(CHECKOUT_CSP);
    const reviewHtml = await review.text();
    expectNoren(reviewHtml, "checkout_confirm");
    expect(reviewHtml).toContain('<div class="banto-confirmation">');

    const placed = await b.post("/checkout/stripe", { quote: quoteFrom(reviewHtml) });
    expect([302, 303]).toContain(placed.status);
    expect(placed.headers.get("location")).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const done = await (await b.get("/checkout/done")).text();
    expectNoren(done, "checkout_done");
  });

  it("会員ページ（{% banto_account %} と CSP）", async () => {
    const { b, shop, mail } = await setup();
    await memberLogin(b, mail, "", "member@example.com");
    await preview(b, shop.id);
    const res = await b.get("/account");
    expect(res.headers.get("content-security-policy")).toBe(CHECKOUT_CSP);
    const html = await res.text();
    expectNoren(html, "customers-account");
    expect(html).toContain("member@example.com");
    expect(html).toContain('action="/account/logout"');
  });

  it("1 ページの最大（48 件）の一覧も描画の上限に収まる", async () => {
    const { sb, shop, b } = await setup();
    for (let i = 0; i < 60; i++) {
      const p = sb.addProduct(shop.id, { slug: `item-${i}`, name: `商品 ${i}`, published: true, tags: [`t${i % 5}`], brand: "暖簾" });
      sb.addSku(shop.id, p.id, { code: `ITEM-${i}`, price_jpy: 1000 + i, compare_at_price_jpy: i % 3 === 0 ? 2000 : null, available: 1 });
      sb.tables.product_images.push({ id: `img-x${i}`, shop_id: shop.id, product_id: p.id, storage_key: `p/x${i}.webp`, thumb_key: `p/x${i}-400.webp`, width: 1600, height: 1200, sort_order: 0, options: {} });
    }
    await preview(b, shop.id);
    const started = performance.now();
    const html = await (await b.get("/")).text();
    const ms = performance.now() - started;
    expectNoren(html, "index");
    expect(html.match(/class="card"/g)?.length).toBe(48);
    expect(html).toContain('rel="next"');
    console.log(`[noren] index with 48 products: ${ms.toFixed(1)} ms (whole request, test doubles included)`);
  });

  it("公開中の版として描く（プレビューでなくても既定のテーマに戻らない）", async () => {
    const { b } = await setup();
    const html = await (await b.get("/p/tee")).text();
    expect(html).toContain('class="noren template-product"');
    expect(html).not.toContain("design.preview_bar");
  });
});
