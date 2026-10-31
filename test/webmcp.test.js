"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const webmcp = require("../public/assets/webmcp.js");

const shops = [
  {
    id: "alpha",
    name: "Alpha Coffee",
    name_en: "Alpha Coffee",
    prefecture: "京都府",
    city: "京都市",
    lat: 35.011,
    lng: 135.768,
    url: "https://alpha.example/",
    purchases: [{ date: "2026-01-01", beans: ["Kenya AA"], source: "メール" }]
  },
  {
    id: "beta",
    name: "Beta Roasters",
    prefecture: "東京都",
    city: "渋谷区",
    lat: 35.659,
    lng: 139.7,
    url: "https://beta.example/",
    shopUrl: "https://shop.beta.example/",
    purchases: [
      { date: "2025-06-01", beans: ["Ethiopia"], note: "好き", source: "Notion" },
      { date: "2026-02-01", beans: ["Colombia"], source: "メール" }
    ]
  },
  {
    id: "gamma",
    name: "Gamma Coffee",
    prefecture: "東京都",
    city: "世田谷区",
    lat: 35.646,
    lng: 139.653,
    url: "https://gamma.example/",
    purchases: [{ date: "2024-03-04", beans: ["Blend"], source: "メール" }]
  },
  {
    id: "webonly",
    name: "Web Only Roasters",
    area: "online",
    prefecture: "",
    city: "",
    lat: null,
    lng: null,
    url: "https://web.example/",
    purchases: [{ date: "2024-02-04", beans: ["Geisha"], source: "メール" }]
  },
  {
    id: "london",
    name: "Workshop Coffee",
    area: "overseas",
    country: "イギリス",
    prefecture: "",
    city: "ロンドン",
    lat: 51.535,
    lng: -0.055,
    url: "https://overseas.example/",
    purchases: [{ date: "2021-03-27", beans: ["Decaf"], source: "メール" }]
  }
];

test("search-shops filters by Japanese prefecture", () => {
  const result = webmcp.searchShops(shops, { prefecture: "京都府" });
  assert.equal(result.count, 1);
  assert.equal(result.shops[0].id, "alpha");
  assert.equal(result.shops[0].purchaseCount, 1);
});

test("search-shops accepts English and short prefecture names", () => {
  assert.equal(webmcp.searchShops(shops, { prefecture: "Tokyo" }).count, 2);
  assert.equal(webmcp.searchShops(shops, { prefecture: "京都" }).shops[0].id, "alpha");
});

test("search-shops filters online and overseas groups", () => {
  assert.equal(webmcp.searchShops(shops, { prefecture: "Online" }).shops[0].id, "webonly");
  assert.equal(webmcp.searchShops(shops, { prefecture: "海外" }).shops[0].id, "london");
});

test("search-shops matches shop name keywords", () => {
  const result = webmcp.searchShops(shops, { query: "beta" });
  assert.equal(result.count, 1);
  assert.equal(result.shops[0].shopUrl, "https://shop.beta.example/");
});

test("search-shops combines query and prefecture", () => {
  const result = webmcp.searchShops(shops, { query: "gamma", prefecture: "東京都" });
  assert.equal(result.count, 1);
  assert.equal(result.shops[0].id, "gamma");
});

test("search-shops returns a structured error for unknown prefecture", () => {
  const result = webmcp.searchShops(shops, { prefecture: "Atlantis" });
  assert.match(result.error, /Unknown prefecture/);
});

test("list-unpurchased-prefectures excludes purchased domestic prefs", () => {
  const result = webmcp.listUnpurchasedPrefectures(shops);
  const names = result.prefectures.map((p) => p.prefecture);
  assert.equal(result.purchasedCount, 2);
  assert.equal(result.unpurchasedCount, 45);
  assert.ok(names.includes("富山県"));
  assert.ok(!names.includes("京都府"));
  assert.ok(!names.includes("東京都"));
  assert.equal(result.prefectures.find((p) => p.prefecture === "富山県").prefecture_en, "Toyama");
});

test("get-shop-purchases returns newest first", () => {
  const result = webmcp.getShopPurchases(shops, { shopId: "beta" });
  assert.equal(result.shop.name, "Beta Roasters");
  assert.equal(result.purchases.length, 2);
  assert.equal(result.purchases[0].date, "2026-02-01");
  assert.equal(result.purchases[1].note, "好き");
});

test("get-shop-purchases resolves a unique name", () => {
  const result = webmcp.getShopPurchases(shops, { name: "Alpha Coffee" });
  assert.equal(result.shop.id, "alpha");
});

test("get-shop-purchases asks for shopId when the name is ambiguous", () => {
  const result = webmcp.getShopPurchases(shops, { name: "Coffee" });
  assert.match(result.error, /Multiple shops/);
  assert.ok(result.candidates.length >= 2);
});

test("get-shop-purchases returns an error when the shop is missing", () => {
  const missingId = webmcp.getShopPurchases(shops, { shopId: "nope" });
  const missingName = webmcp.getShopPurchases(shops, {});
  assert.match(missingId.error, /not found/);
  assert.match(missingName.error, /shopId or name/);
});

test("createTools wires handlers and focus-shop updates the map", () => {
  let focused = null;
  const tools = webmcp.createTools({
    getShops: () => shops,
    focusShop: (id) => { focused = id; }
  });
  assert.deepEqual(tools.map((t) => t.name), [
    "search-shops",
    "list-unpurchased-prefectures",
    "get-shop-purchases",
    "focus-shop"
  ]);
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[3].annotations.readOnlyHint, false);

  const listed = tools[0].execute({ prefecture: "Kyoto" });
  assert.equal(listed.shops[0].id, "alpha");

  const focusedResult = tools[3].execute({ name: "Beta Roasters" });
  assert.equal(focused, "beta");
  assert.equal(focusedResult.focused, true);
  assert.equal(focusedResult.shop.city, "渋谷区");
});

test("register is a no-op without document.modelContext", async () => {
  assert.equal(await webmcp.register({ getShops: () => shops, focusShop: () => {} }), false);
});

test("register uses document.modelContext.registerTool when present", async () => {
  const names = [];
  globalThis.document = {
    modelContext: {
      async registerTool(tool) { names.push(tool.name); }
    }
  };
  try {
    assert.equal(await webmcp.register({ getShops: () => shops, focusShop: () => {} }), true);
    assert.deepEqual(names, [
      "search-shops",
      "list-unpurchased-prefectures",
      "get-shop-purchases",
      "focus-shop"
    ]);
  } finally {
    delete globalThis.document;
  }
});
