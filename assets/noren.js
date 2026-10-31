/*
 * 暖簾（noren）の JS。JS が無くても買えるようにし、ここでは上乗せだけをする。
 * - 商品のページ: SKU を選び直したら、そのセクションを ?sku= で描き直して差し替える（値段・在庫・SKU ごとの画像の並びは Banto が決める）
 * - カートに入れる: ページを移らずに /cart/add（JSON）へ送り、ヘッダーを描き直す（テーマの設定でオフにできる）
 * 外への通信はしない（ショップのドメインだけ）。type="module" にしない（API のプレビューは sandbox で module を読めない）
 */
(function () {
  "use strict";

  var body = document.body;
  var statusTimer = 0;

  function announce(text) {
    var el = document.querySelector("[data-noren-status]");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      el.hidden = true;
    }, 4000);
  }

  function parseHtml(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  // ---------- 商品のページ: SKU の選び直し ----------
  function onVariantChange(select) {
    var section = select.closest("[data-noren-product]");
    if (!section) return;
    var option = select.options[select.selectedIndex];
    var sku = option && option.getAttribute("data-sku");
    if (!sku) return;
    var base = section.getAttribute("data-product-url");
    var id = section.getAttribute("data-section-id");
    var url = new URL(base, location.href);
    url.searchParams.set("sku", sku);
    history.replaceState(null, "", url.pathname + url.search);
    url.searchParams.set("section_id", id);
    var selectId = select.id;
    fetch(url.pathname + url.search, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
      .then(function (html) {
        var next = parseHtml(html).querySelector("[data-noren-product]");
        if (!next) return;
        // 数量の入力はそのまま残す
        var qty = section.querySelector('input[name="quantity"]');
        var nextQty = next.querySelector('input[name="quantity"]');
        if (qty && nextQty) nextQty.value = qty.value;
        section.replaceWith(next);
        var again = selectId && document.getElementById(selectId);
        if (again) again.focus();
      })
      .catch(function () {
        // 描き直せなくても、選んだ SKU のままフォームは送れる
      });
  }

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t instanceof HTMLSelectElement && t.hasAttribute("data-noren-variant")) onVariantChange(t);
  });

  // ---------- カートに入れる（ページを移らずに） ----------
  function addToCart(form) {
    var button = form.querySelector("[data-noren-add]");
    var data = new FormData(form);
    var payload = {
      id: String(data.get("id") || ""),
      quantity: Number(data.get("quantity") || 1),
      sections: "header",
    };
    if (button) button.setAttribute("aria-busy", "true");
    return fetch(body.getAttribute("data-cart-add-url") || "/cart/add", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (json) {
          return { ok: res.ok, json: json };
        });
      })
      .then(function (r) {
        if (!r.ok) {
          announce((r.json && (r.json.description || r.json.message)) || body.getAttribute("data-msg-add-failed") || "");
          return;
        }
        var header = r.json && r.json.sections && r.json.sections.header;
        var current = document.getElementById("shopify-section-header");
        if (header && current) {
          var next = parseHtml(header).getElementById("shopify-section-header");
          if (next) current.replaceWith(next);
        }
        announce(body.getAttribute("data-msg-added") || "");
      })
      .finally(function () {
        if (button) button.removeAttribute("aria-busy");
      });
  }

  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains("product-form")) return;
    if (!body.hasAttribute("data-noren-ajax-cart") || !window.fetch) return;
    e.preventDefault();
    addToCart(form).catch(function () {
      // 送れなかった（通信の失敗・切り離したプレビュー）ときは、ふつうにフォームを送る
      form.submit();
    });
  });
})();
