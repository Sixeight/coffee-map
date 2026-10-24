(() => {
  "use strict";
  const STORAGE_KEY = "roaster-map-lang";

  const STRINGS = {
    ja: {
      title: "通販で買ったコーヒー豆のお店マップ",
      description: "オンラインショップでコーヒー豆を買った焙煎所を地図にまとめた記録。店頭やカフェで買った分は含みません。",
      heading: "通販で買った<wbr>コーヒー豆のお店",
      lede: "オンラインショップで豆を取り寄せた焙煎所の記録です。",
      scope: "通販（オンライン注文）で買った豆だけを載せています。店頭やカフェで買った分は含みません。",
      tickerLabel: "最近の注文",
      tickerPause: "止める",
      tickerPlay: "流す",
      mapLabel: "地図",
      mapAria: "焙煎所の地図",
      resetView: "全国を表示",
      listLabel: "お店の一覧",
      search: "検索",
      searchPlaceholder: "店名・豆・都道府県で検索",
      regionFilter: "地方で絞り込み",
      prefecture: "都道府県",
      all: "すべて",
      sort: "並べ替え",
      sortDate: "注文日が新しい順",
      sortNorth: "北から（都道府県順）",
      sortCount: "通販での購入が多い順",
      sortName: "店名順",
      prefsTitle: "都道府県の塗りつぶし",
      prefsNote: "色がついている県は、そこにある焙煎所から通販で豆を買ったことがある県です。押すとその県で絞り込みます。",
      footer1: "記録しているのはオンラインショップでの購入のみです（店頭・カフェでの購入は含みません）。焙煎所の所在地がわからないお店は「オンライン」、海外のお店は「海外」に分けて載せています（都道府県の数には含めません）。購入ごとの出典は Notion の記録または注文メールです。",
      footer2: "店の所在地は各店の公式サイト・特定商取引法の表記をもとにしています。ピンは市区町村内のおおよその位置です。",
      mapCredit: "地図:",
      gsiPale: "国土地理院 淡色地図",
      dataUpdated: "データ更新: {date}",
      loadError: "データを読み込めませんでした（{error}）。",
      statShops: "お店",
      statShopsUnit: "軒",
      statPrefs: "都道府県",
      statPrefsUnit: "/ 47",
      statOrders: "通販での購入",
      statOrdersUnit: "回",
      statBeans: "豆・セット",
      statBeansUnit: "種",
      statLatest: "最近の注文",
      noDate: "日付の記録なし",
      placeOnline: "オンラインのみ（所在地未確認）",
      overseas: "海外",
      online: "オンライン",
      other: "その他",
      source: "出典:",
      orderDate: "メールの注文日:",
      shopBtn: "オンラインショップ ↗",
      siteBtn: "公式サイト ↗",
      times: "{n}回",
      resultAll: "{n}軒すべてを表示中",
      resultSome: "{n}軒を表示中（全{total}軒）",
      langSwitch: "言語",
      sourceMail: "メール"
    },
    en: {
      title: "Map of coffee roasters I ordered from online",
      description: "A personal map of coffee roasters I bought beans from through their online shops. In-store and café purchases are not included.",
      heading: "Roasters I ordered beans from online",
      lede: "A record of roasters I ordered beans from online.",
      scope: "Only beans bought through online shops. In-store and café purchases are not included.",
      tickerLabel: "Recent orders",
      tickerPause: "Pause",
      tickerPlay: "Play",
      mapLabel: "Map",
      mapAria: "Map of roasters",
      resetView: "Show Japan",
      listLabel: "Shop list",
      search: "Search",
      searchPlaceholder: "Search shops, beans, prefectures",
      regionFilter: "Filter by region",
      prefecture: "Prefecture",
      all: "All",
      sort: "Sort",
      sortDate: "Newest order",
      sortNorth: "North to south",
      sortCount: "Most online orders",
      sortName: "Shop name",
      prefsTitle: "Prefectures filled in",
      prefsNote: "Colored prefectures are ones where I ordered beans from a roaster based there. Tap to filter by that prefecture.",
      footer1: "This map records online shop purchases only (in-store and café purchases are not included). Shops whose roastery location could not be confirmed are listed as Online; shops outside Japan as Overseas (neither counts toward the prefecture total). Sources for each purchase are Notion notes or order emails.",
      footer2: "Locations come from each shop’s official site or legal notices. Pins are approximate positions within the city or ward.",
      mapCredit: "Map:",
      gsiPale: "GSI pale map",
      dataUpdated: "Updated: {date}",
      loadError: "Couldn’t load the data ({error}).",
      statShops: "Shops",
      statShopsUnit: "",
      statPrefs: "Prefectures",
      statPrefsUnit: "/ 47",
      statOrders: "Online orders",
      statOrdersUnit: "",
      statBeans: "Beans",
      statBeansUnit: "",
      statLatest: "Latest order",
      noDate: "No date recorded",
      placeOnline: "Online only (location unconfirmed)",
      overseas: "Overseas",
      online: "Online",
      other: "Other",
      source: "Source:",
      orderDate: "Order date (email):",
      shopBtn: "Online shop ↗",
      siteBtn: "Official site ↗",
      times: "×{n}",
      resultAll: "Showing all {n} shops",
      resultSome: "Showing {n} of {total} shops",
      langSwitch: "Language",
      sourceMail: "Email"
    }
  };

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
    "宮崎県": "Miyazaki", "鹿児島県": "Kagoshima", "沖縄県": "Okinawa",
    "海外": "Overseas", "オンライン": "Online"
  };

  const REGION_EN = {
    "北海道・東北": "Hokkaido / Tohoku",
    "関東": "Kanto",
    "中部": "Chubu",
    "近畿": "Kansai",
    "中国・四国": "Chugoku / Shikoku",
    "九州・沖縄": "Kyushu / Okinawa",
    "その他": "Other",
    "海外": "Overseas",
    "オンライン": "Online"
  };

  const fill = (s, vars) => vars
    ? String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? "" : vars[k]))
    : s;

  const readQueryLang = () => {
    const q = new URLSearchParams(location.search).get("lang");
    if (!q) return "";
    const v = q.toLowerCase();
    return v === "en" || v === "ja" ? v : "";
  };

  const detectLang = () => {
    const fromQuery = readQueryLang();
    if (fromQuery) return fromQuery;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "ja") return saved;
    } catch (_) { /* private mode */ }
    const nav = (navigator.language || (navigator.languages && navigator.languages[0]) || "").toLowerCase();
    return nav.startsWith("en") ? "en" : "ja";
  };

  let lang = detectLang();

  const setMeta = (name, value, attr) => {
    const sel = attr === "property" ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    const el = document.querySelector(sel);
    if (el) el.setAttribute("content", value);
  };

  const applyMeta = () => {
    document.documentElement.lang = lang;
    document.title = I18N.t("title");
    setMeta("description", I18N.t("description"));
    setMeta("og:title", I18N.t("title"), "property");
    setMeta("og:site_name", I18N.t("title"), "property");
    setMeta("og:description", I18N.t("description"), "property");
    setMeta("og:locale", lang === "en" ? "en_US" : "ja_JP", "property");
    setMeta("twitter:title", I18N.t("title"));
    setMeta("twitter:description", I18N.t("description"));
  };

  const applySwitch = () => {
    const nav = document.querySelector(".lang-switch");
    if (!nav) return;
    nav.setAttribute("aria-label", I18N.t("langSwitch"));
    nav.querySelectorAll("[data-lang]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
  };

  const applyStatic = () => {
    applyMeta();
    applySwitch();
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = I18N.t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = I18N.t(el.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", I18N.t(el.dataset.i18nPlaceholder));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", I18N.t(el.dataset.i18nAria));
    });
  };

  const syncUrl = () => {
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  };

  const I18N = {
    get lang() { return lang; },
    t(key, vars) {
      const table = STRINGS[lang] || STRINGS.ja;
      return fill(table[key] ?? STRINGS.ja[key] ?? key, vars);
    },
    pref(name) { return lang === "en" ? (PREF_EN[name] || name) : name; },
    region(name) { return lang === "en" ? (REGION_EN[name] || name) : name; },
    field(obj, key) {
      if (!obj) return "";
      if (lang === "en") {
        const en = obj[`${key}_en`];
        if (en != null && en !== "") return en;
      }
      return obj[key];
    },
    source(value) {
      return String(value || "").split("+").map((p) => (p === "メール" ? I18N.t("sourceMail") : p)).join(" / ");
    },
    setLang(next) {
      if (next !== "en" && next !== "ja") return;
      if (next === lang) {
        syncUrl();
        applyStatic();
        return;
      }
      lang = next;
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* private mode */ }
      syncUrl();
      applyStatic();
      document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
    },
    applyStatic,
    PREF_EN,
    REGION_EN
  };

  window.I18N = I18N;
  applyMeta();
  if (lang === "en" || readQueryLang()) syncUrl();
  const start = () => applyStatic();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  document.addEventListener("click", (e) => {
    const b = e.target.closest(".lang-switch [data-lang]");
    if (!b) return;
    I18N.setLang(b.dataset.lang);
  });
})();
