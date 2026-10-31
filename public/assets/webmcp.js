(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RoasterMapWebMCP = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PREFS = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
  const PREF_EN = {
    "北海道": "Hokkaido", "青森県": "Aomori", "岩手県": "Iwate", "宮城県": "Miyagi",
    "秋田県": "Akita", "山形県": "Yamagata", "福島県": "Fukushima", "茨城県": "Ibaraki",
    "栃木県": "Tochigi", "群馬県": "Gunma", "埼玉県": "Saitama", "千葉県": "Chiba",
    "東京都": "Tokyo", "神奈川県": "Kanagawa", "新潟県": "Niigata", "富山県": "Toyama",
    "石川県": "Ishikawa", "福井県": "Fukui", "山梨県": "Yamanashi", "長野県": "Nagano",
    "岐阜県": "Gifu", "静岡県": "Shizuoka", "愛知県": "Aichi", "三重県": "Mie",
    "滋賀県": "Shiga", "京都府": "Kyoto", "大阪府": "Osaka", "兵庫県": "Hyogo",
    "奈良県": "Nara", "和歌山県": "Wakayama", "鳥取県": "Tottori", "島根県": "Shimane",
    "岡山県": "Okayama", "広島県": "Hiroshima", "山口県": "Yamaguchi", "徳島県": "Tokushima",
    "香川県": "Kagawa", "愛媛県": "Ehime", "高知県": "Kochi", "福岡県": "Fukuoka",
    "佐賀県": "Saga", "長崎県": "Nagasaki", "熊本県": "Kumamoto", "大分県": "Oita",
    "宮崎県": "Miyazaki", "鹿児島県": "Kagoshima", "沖縄県": "Okinawa"
  };

  const norm = (s) => String(s ?? "").trim().toLowerCase();
  const shortPref = (p) => p === "北海道" ? "北海道" : p.replace(/[都府県]$/, "");
  const latestDate = (s) => (s.purchases || []).map((p) => p.date).filter(Boolean).sort().pop() || null;

  function resolvePlace(input) {
    const raw = String(input ?? "").trim();
    if (!raw) return { kind: "empty" };
    const q = norm(raw);
    if (q === "海外" || q === "overseas") return { kind: "overseas" };
    if (q === "オンライン" || q === "online") return { kind: "online" };
    for (const p of PREFS) {
      if (p === raw || shortPref(p) === raw) return { kind: "pref", prefecture: p };
      if (norm(PREF_EN[p]) === q) return { kind: "pref", prefecture: p };
    }
    return { kind: "unknown", input: raw };
  }

  function summarizeShop(s) {
    const out = {
      id: s.id,
      name: s.name,
      prefecture: s.prefecture || null,
      city: s.city || null,
      url: s.url,
      purchaseCount: (s.purchases || []).length,
      latestPurchase: latestDate(s)
    };
    if (s.name_en) out.name_en = s.name_en;
    if (s.shopUrl) out.shopUrl = s.shopUrl;
    if (s.area) out.area = s.area;
    if (s.country) out.country = s.country;
    if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
      out.lat = s.lat;
      out.lng = s.lng;
    }
    return out;
  }

  function matchesQuery(s, query) {
    const q = norm(query);
    if (!q) return true;
    const hay = [
      s.id, s.name, s.name_en, s.prefecture, PREF_EN[s.prefecture],
      s.city, s.city_en, s.country, s.country_en, s.area
    ].filter(Boolean).map(norm).join(" ");
    return q.split(/\s+/).every((t) => hay.includes(t));
  }

  function matchesPlace(s, place) {
    if (place.kind === "empty") return true;
    if (place.kind === "overseas") return s.area === "overseas";
    if (place.kind === "online") return s.area === "online";
    if (place.kind === "pref") return !s.area && s.prefecture === place.prefecture;
    return false;
  }

  function searchShops(shops, { query, prefecture } = {}) {
    const place = resolvePlace(prefecture);
    if (place.kind === "unknown") {
      return {
        error: `Unknown prefecture "${place.input}". Use a Japanese name (京都府), a short name (京都), English (Kyoto), 海外 / Overseas, or オンライン / Online.`
      };
    }
    const list = shops.filter((s) => matchesQuery(s, query) && matchesPlace(s, place));
    return { count: list.length, shops: list.map(summarizeShop) };
  }

  function listUnpurchasedPrefectures(shops) {
    const purchased = new Set(shops.filter((s) => !s.area && PREFS.includes(s.prefecture)).map((s) => s.prefecture));
    const prefectures = PREFS.filter((p) => !purchased.has(p)).map((p) => ({
      prefecture: p,
      prefecture_en: PREF_EN[p]
    }));
    return {
      purchasedCount: purchased.size,
      unpurchasedCount: prefectures.length,
      prefectures
    };
  }

  function findShops(shops, { shopId, name } = {}) {
    const id = String(shopId ?? "").trim();
    if (id) {
      const exact = shops.find((s) => s.id === id);
      return exact ? [exact] : [];
    }
    const q = norm(name);
    if (!q) return [];
    const exact = shops.filter((s) => norm(s.id) === q || norm(s.name) === q || norm(s.name_en) === q);
    if (exact.length) return exact;
    return shops.filter((s) =>
      norm(s.id).includes(q) || norm(s.name).includes(q) || norm(s.name_en).includes(q));
  }

  function resolveShop(shops, input) {
    const id = String(input?.shopId ?? "").trim();
    const name = String(input?.name ?? "").trim();
    if (!id && !name) return { error: "Pass shopId or name." };
    const matches = findShops(shops, { shopId: id, name });
    if (!matches.length) {
      return { error: id ? `Shop "${id}" was not found.` : `No shop matched "${name}".` };
    }
    if (!id && matches.length > 1) {
      return {
        error: `Multiple shops matched "${name}". Pass shopId to choose one.`,
        candidates: matches.map(summarizeShop)
      };
    }
    return { shop: matches[0] };
  }

  function getShopPurchases(shops, input = {}) {
    const found = resolveShop(shops, input);
    if (found.error) return found;
    const purchases = [...(found.shop.purchases || [])]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map((p) => ({
        date: p.date ?? null,
        beans: p.beans || [],
        note: p.note || null,
        source: p.source || null,
        dateNote: p.dateNote || null,
        orderDate: p.orderDate || null
      }));
    return { shop: summarizeShop(found.shop), purchases };
  }

  function createTools({ getShops, focusShop }) {
    const shopsOf = () => getShops() || [];
    return [
      {
        name: "search-shops",
        description: "Search coffee roasters recorded on this map by shop name or prefecture. Use when listing or finding shops.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Shop name, city, or keyword." },
            prefecture: { type: "string", description: "Prefecture or group to filter by." }
          }
        },
        execute({ query, prefecture } = {}) {
          return searchShops(shopsOf(), { query, prefecture });
        },
        annotations: { readOnlyHint: true }
      },
      {
        name: "list-unpurchased-prefectures",
        description: "List Japanese prefectures that do not yet have a recorded mail-order purchase from a roaster there.",
        inputSchema: { type: "object", properties: {} },
        execute() {
          return listUnpurchasedPrefectures(shopsOf());
        },
        annotations: { readOnlyHint: true }
      },
      {
        name: "get-shop-purchases",
        description: "Return the mail-order purchase history for one roaster.",
        inputSchema: {
          type: "object",
          properties: {
            shopId: { type: "string", description: "Stable shop id from search-shops." },
            name: { type: "string", description: "Shop name when the id is unknown." }
          }
        },
        execute(input = {}) {
          return getShopPurchases(shopsOf(), input);
        },
        annotations: { readOnlyHint: true }
      },
      {
        name: "focus-shop",
        description: "Focus the map and shop list on one roaster. Use after search-shops when the user wants to look at that shop.",
        inputSchema: {
          type: "object",
          properties: {
            shopId: { type: "string", description: "Stable shop id from search-shops." },
            name: { type: "string", description: "Shop name when the id is unknown." }
          }
        },
        execute(input = {}) {
          const found = resolveShop(shopsOf(), input);
          if (found.error) return found;
          if (typeof focusShop === "function") focusShop(found.shop.id);
          return { focused: true, shop: summarizeShop(found.shop) };
        },
        annotations: { readOnlyHint: false }
      }
    ];
  }

  async function register(options) {
    if (typeof document === "undefined" || !("modelContext" in document) || !document.modelContext) {
      return false;
    }
    const registerTool = document.modelContext.registerTool;
    if (typeof registerTool !== "function") return false;
    try {
      for (const tool of createTools(options)) {
        await registerTool.call(document.modelContext, tool);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  return {
    PREFS,
    searchShops,
    listUnpurchasedPrefectures,
    getShopPurchases,
    resolveShop,
    createTools,
    register
  };
});
