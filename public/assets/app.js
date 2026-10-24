(() => {
  "use strict";
  const PREFS = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];
  const REGIONS = [
    ["北海道・東北", 0, 7], ["関東", 7, 14], ["中部", 14, 23],
    ["近畿", 23, 30], ["中国・四国", 30, 39], ["九州・沖縄", 39, 47]
  ];
  const regionOf = (pref) => {
    const i = PREFS.indexOf(pref);
    const r = REGIONS.find(([, a, b]) => i >= a && i < b);
    return r ? r[0] : "その他";
  };
  const EXTRA = ["海外", "オンライン"];
  const regionOfShop = (s) => s.area === "online" ? "オンライン" : s.area === "overseas" ? "海外" : regionOf(s.prefecture);
  const hasCoords = (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng);
  const placeOf = (s) => s.area === "online" ? "オンラインのみ（所在地未確認）" : s.area === "overseas" ? `${s.country || "海外"} ${s.city || ""}` : `${s.prefecture} ${s.city || ""}`;
  const badgeOf = (s) => s.area === "online" ? "WEB" : s.area === "overseas" ? "海外" : shortPref(s.prefecture);
  const JAPAN = L.latLngBounds([20, 122], [46.5, 154]);
  const shortPref = (p) => p === "北海道" ? "北海道" : p.replace(/[都府県]$/, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => {
    if (!d) return "日付の記録なし";
    const [y, m, day] = d.split("-").map(Number);
    const pad = (n) => String(n).padStart(2, "0");
    return `${y}.${pad(m)}${day ? "." + pad(day) : ""}`;
  };
  const isShopUrl = (u) => /(\.stores\.jp|\.thebase\.in|\.base\.shop|\.theshop\.jp|\.square\.site|rakuten\.co\.jp|\/\/shop\.|\.shop\/)/.test(u || "");
  const latestDate = (s) => s.purchases.map((p) => p.date).filter(Boolean).sort().pop() || "";

  const state = { q: "", region: "", pref: "", sort: "date", active: null };
  let shops = [];
  const markers = new Map();
  let map, recentIds = new Set();

  const $ = (id) => document.getElementById(id);

  fetch("data/shops.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch((e) => {
      $("list").innerHTML = `<li class="item">データを読み込めませんでした（${esc(e.message)}）。</li>`;
    });

  function init(data) {
    shops = data.shops.map((s) => ({
      ...s,
      region: regionOfShop(s),
      prefIndex: s.area === "overseas" ? 100 : s.area === "online" ? 200 : PREFS.indexOf(s.prefecture),
      latest: latestDate(s),
      count: s.purchases.length,
      haystack: [s.name, s.prefecture, s.city, s.country || "", regionOfShop(s), ...s.purchases.flatMap((p) => [...p.beans, p.note || ""]), s.memo || ""].join(" ").toLowerCase()
    }));
    recentIds = new Set([...shops].filter((s) => s.latest).sort((a, b) => b.latest.localeCompare(a.latest)).slice(0, 3).map((s) => s.id));
    if (data.updated) $("updated").textContent = `データ更新: ${fmtDate(data.updated)}`;
    renderStats();
    renderTicker();
    initMap();
    renderChips();
    renderPrefSelect();
    renderPrefGrid();
    bind();
    update();
    const fromHash = decodeURIComponent(location.hash.slice(1));
    if (fromHash && shops.some((s) => s.id === fromHash)) setActive(fromHash, "instant");
  }

  function renderStats() {
    const prefs = new Set(shops.filter((s) => !s.area && PREFS.includes(s.prefecture)).map((s) => s.prefecture));
    const purchases = shops.reduce((n, s) => n + s.count, 0);
    const beans = shops.reduce((n, s) => n + s.purchases.reduce((m, p) => m + p.beans.length, 0), 0);
    const latest = [...shops].filter((s) => s.latest).sort((a, b) => b.latest.localeCompare(a.latest))[0];
    const items = [
      ["お店", shops.length, "軒"],
      ["都道府県", prefs.size, "/ 47"],
      ["通販での購入", purchases, "回"],
      ["豆・セット", beans, "種"],
    ];
    $("stats").innerHTML = items.map(([k, v, u]) => `<div><dt>${k}</dt><dd>${v}<small>${u}</small></dd></div>`).join("") +
      (latest ? `<div class="latest"><dt>最近の注文</dt><dd>${esc(latest.name)}<small>${esc(fmtDate(latest.latest))}</small></dd></div>` : "");
  }

  function renderTicker() {
    const recent = shops.flatMap((s) => s.purchases.filter((p) => p.date).map((p) => ({ s, p })))
      .sort((a, b) => b.p.date.localeCompare(a.p.date)).slice(0, 10);
    const row = (copy) => recent.map(({ s, p }) => {
      const el = copy ? "span" : "button";
      return `<${el} class="tick"${copy ? "" : ' type="button"'} data-id="${esc(s.id)}"><b>${esc(fmtDate(p.date))}</b>${esc(s.name)}<span>${esc(p.beans[0] || "")}</span></${el}>`;
    }).join("");
    document.querySelector(".ticker").hidden = !recent.length;
    // 同じ並びを2つ続けて、半分流れたところで先頭に戻すと切れ目なく見える
    $("ticker").innerHTML = `<div class="ticker-row">${row(false)}</div><div class="ticker-row" aria-hidden="true">${row(true)}</div>`;
  }

  function initMap() {
    map = window.coffeeMap = L.map("map", { zoomControl: true, scrollWheelZoom: true, minZoom: 3, maxZoom: 17, zoomSnap: 0.25 });
    // 国内は国土地理院の淡色地図。日本が画面に入らないとき（海外のお店）は Esri の淡色地図に切り替える
    const gsi = L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>',
      maxZoom: 18, className: "tiles-warm"
    }).addTo(map);
    const esri = (name) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${name}/MapServer/tile/{z}/{y}/{x}`;
    const world = L.layerGroup([
      L.tileLayer(esri("World_Light_Gray_Base"), {
        attribution: 'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> — Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
        maxNativeZoom: 16, maxZoom: 18, className: "tiles-warm"
      }),
      L.tileLayer(esri("World_Light_Gray_Reference"), { maxNativeZoom: 16, maxZoom: 18 })
    ]);
    const pickTiles = () => {
      const inJapan = map.getBounds().intersects(JAPAN);
      if (inJapan && !map.hasLayer(gsi)) { map.addLayer(gsi); map.removeLayer(world); }
      else if (!inJapan && !map.hasLayer(world)) { map.addLayer(world); map.removeLayer(gsi); }
    };
    map.on("moveend zoomend", pickTiles);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
    shops.filter(hasCoords).forEach((s) => {
      const icon = L.divIcon({
        className: "pin-wrap",
        html: `<div class="pin${recentIds.has(s.id) ? " recent" : ""}"><span>${s.count > 1 ? s.count : ""}</span></div>`,
        iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24]
      });
      const m = L.marker([s.lat, s.lng], { icon, title: s.name, riseOnHover: true, keyboard: true })
        .bindPopup(() => popupHtml(s), { maxWidth: 320, maxHeight: 440, autoPanPadding: [24, 24] })
        .addTo(map);
      m.on("popupopen", () => setActive(s.id, false));
      m.on("popupclose", () => { if (state.active === s.id) setActive(null, false); });
      markers.set(s.id, m);
    });
    fitAll();
    const refit = () => { map.invalidateSize(); if (!state.active) fitAll(filtered()); };
    window.addEventListener("load", refit);
    if (document.fonts) document.fonts.ready.then(refit);
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(refit, 200); });
  }

  function fitAll(list = shops) {
    // 地図に置けるお店だけで範囲を決める。国内が含まれるときは国内だけ（初期表示は日本）
    const pts = list.filter(hasCoords);
    const dom = pts.filter((s) => s.area !== "overseas");
    const use = dom.length ? dom : pts;
    if (!use.length) return;
    list = use;
    const b = L.latLngBounds(list.map((s) => [s.lat, s.lng]));
    map.fitBounds(b, { padding: [36, 36], maxZoom: list.length > 1 ? 11 : 12, animate: true });
  }

  function popupHtml(s) {
    const ps = [...s.purchases].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((p) => `
      <div class="purchase">
        <div class="p-date">${esc(fmtDate(p.date))}${p.dateNote ? `<em>（${esc(p.dateNote)}）</em>` : ""}${p.source ? `<span class="src">出典: ${esc(p.source.replace("+", " / "))}</span>` : ""}</div>
        ${p.orderDate ? `<div class="p-order">メールの注文日: ${esc(fmtDate(p.orderDate))}</div>` : ""}
        <ul class="beans">${p.beans.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
        ${p.note ? `<p class="note">${esc(p.note)}</p>` : ""}
      </div>`).join("");
    const shopLink = s.shopUrl || (isShopUrl(s.url) ? s.url : "");
    const links = shopLink
      ? [`<a class="btn primary" href="${esc(shopLink)}" target="_blank" rel="noopener">オンラインショップ ↗</a>`]
      : [];
    if (s.url !== shopLink) links.push(`<a class="btn${shopLink ? "" : " primary"}" href="${esc(s.url)}" target="_blank" rel="noopener">公式サイト ↗</a>`);
    return `
      <div class="pop-pref">${esc(placeOf(s))}</div>
      <div class="pop-name">${esc(s.name)}${s.count > 1 ? `<span class="count">${s.count}回</span>` : ""}</div>
      ${ps}
      ${s.memo ? `<p class="note">${esc(s.memo)}</p>` : ""}
      ${s.recordedAs ? `<p class="meta">${esc(s.recordedAs)}</p>` : ""}
      <div class="links">${links.join("")}</div>`;
  }

  function renderChips() {
    const counts = Object.fromEntries(REGIONS.map(([r]) => [r, shops.filter((s) => s.region === r).length]));
    EXTRA.forEach((r) => { counts[r] = shops.filter((s) => s.region === r).length; });
    const all = [["", "すべて", shops.length], ...REGIONS.map(([r]) => [r, r, counts[r]]), ...EXTRA.map((r) => [r, r, counts[r]])];
    $("regionChips").innerHTML = all.filter(([, , n]) => n > 0).map(([v, label, n]) =>
      `<button class="chip" type="button" data-region="${esc(v)}" aria-pressed="${state.region === v}">${esc(label)}<small>${n}</small></button>`).join("");
  }

  function renderPrefSelect() {
    const sel = $("pref");
    const present = PREFS.filter((p) => shops.some((s) => s.prefecture === p && (!state.region || s.region === state.region)));
    sel.innerHTML = `<option value="">すべて</option>` + present.map((p) => `<option value="${esc(p)}">${esc(p)}（${shops.filter((s) => s.prefecture === p).length}）</option>`).join("");
    if (!present.includes(state.pref)) state.pref = "";
    sel.value = state.pref;
  }

  function renderPrefGrid() {
    const have = new Set(shops.filter((s) => !s.area).map((s) => s.prefecture));
    $("prefGrid").innerHTML = REGIONS.map(([r, a, b]) => `
      <div class="region"><h3>${esc(r)}</h3><div class="tiles">${PREFS.slice(a, b).map((p) =>
        `<button class="tile${have.has(p) ? " on" : ""}${state.pref === p ? " sel" : ""}" type="button" data-pref="${esc(p)}" ${have.has(p) ? "" : "disabled"} title="${esc(p)}">${esc(shortPref(p))}</button>`).join("")}</div></div>`).join("");
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    let list = shops.filter((s) =>
      (!state.region || s.region === state.region) &&
      (!state.pref || s.prefecture === state.pref) &&
      (!q || q.split(/\s+/).every((t) => s.haystack.includes(t))));
    const by = {
      date: (a, b) => (b.latest || "0").localeCompare(a.latest || "0") || a.prefIndex - b.prefIndex,
      north: (a, b) => a.prefIndex - b.prefIndex || b.lat - a.lat,
      count: (a, b) => b.count - a.count || (b.latest || "0").localeCompare(a.latest || "0"),
      name: (a, b) => a.name.localeCompare(b.name, "ja")
    }[state.sort];
    return list.sort(by);
  }

  function update({ fit = false } = {}) {
    const list = filtered();
    const ids = new Set(list.map((s) => s.id));
    $("resultCount").textContent = list.length === shops.length ? `${shops.length}軒すべてを表示中` : `${list.length}軒を表示中（全${shops.length}軒）`;
    $("list").innerHTML = list.map((s) => {
      const beans = s.purchases.flatMap((p) => p.beans);
      return `<li class="item${state.active === s.id ? " active" : ""}" tabindex="0" data-id="${esc(s.id)}">
        <div class="badge${s.area ? " " + esc(s.area) : ""}">${esc(badgeOf(s))}</div>
        <div>
          <div class="i-name">${esc(s.name)}${s.count > 1 ? `<span class="count">${s.count}回</span>` : ""}</div>
          <div class="i-sub"><span>${esc(placeOf(s))}</span><span>${esc(s.latest ? fmtDate(s.latest) : "日付の記録なし")}</span></div>
          <div class="i-beans">${esc(beans.join(" / "))}</div>
          ${state.active === s.id && !hasCoords(s) ? `<div class="inline-pop">${popupHtml(s)}</div>` : ""}
        </div></li>`;
    }).join("");
    markers.forEach((m, id) => {
      const el = m.getElement();
      if (el) el.classList.toggle("dim", !ids.has(id));
      el && el.classList.toggle("active", state.active === id);
    });
    if (fit) fitAll(list.length ? list : shops);
  }

  function setActive(id, fly) {
    const prev = shops.find((x) => x.id === state.active);
    state.active = id;
    if (prev && !hasCoords(prev) && prev.id !== id) update();
    document.querySelectorAll(".item").forEach((el) => el.classList.toggle("active", el.dataset.id === id));
    markers.forEach((m, mid) => { const el = m.getElement(); el && el.classList.toggle("active", mid === id); });
    if (id) history.replaceState(null, "", "#" + encodeURIComponent(id));
    else if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    const s = id && shops.find((x) => x.id === id);
    if (s && !hasCoords(s)) {
      // 地図に置けないお店（オンライン）は一覧の中で詳細を開く
      map.closePopup(); update();
      const li = document.querySelector(`.item[data-id="${CSS.escape(id)}"]`);
      if (li && fly) li.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (id && fly) {
      const m = markers.get(id);
      const isNarrow = window.matchMedia("(max-width:960px)").matches;
      if (isNarrow) document.querySelector(".map-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
      if (fly === "instant") { map.setView([s.lat, s.lng], 10, { animate: false }); m.openPopup(); return; }
      map.flyTo([s.lat, s.lng], Math.max(map.getZoom(), 10), { duration: 0.8 });
      map.once("moveend", () => m.openPopup());
    }
  }

  function bind() {
    let t;
    $("q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; update({ fit: true }); }, 120); });
    $("regionChips").addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      state.region = b.dataset.region;
      document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.region === state.region)));
      renderPrefSelect(); renderPrefGrid(); update({ fit: true });
    });
    $("pref").addEventListener("change", (e) => { state.pref = e.target.value; renderPrefGrid(); update({ fit: true }); });
    $("sort").addEventListener("change", (e) => { state.sort = e.target.value; update(); });
    const pick = (e) => {
      if (e.target.closest("a")) return;
      const li = e.target.closest(".item"); if (!li || !li.dataset.id) return;
      const s = shops.find((x) => x.id === li.dataset.id);
      if (s && !hasCoords(s) && state.active === s.id) { setActive(null, false); update(); return; }
      setActive(li.dataset.id, true);
    };
    $("list").addEventListener("click", pick);
    $("list").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(e); } });
    $("prefGrid").addEventListener("click", (e) => {
      const b = e.target.closest(".tile.on"); if (!b) return;
      state.region = ""; state.pref = state.pref === b.dataset.pref ? "" : b.dataset.pref;
      document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.region === "")));
      renderPrefSelect(); renderPrefGrid(); update({ fit: true });
      document.querySelector(".layout").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("ticker").addEventListener("click", (e) => {
      const b = e.target.closest(".tick"); if (!b) return;
      if (!filtered().some((s) => s.id === b.dataset.id)) {
        state.q = ""; state.region = ""; state.pref = ""; $("q").value = "";
        document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.region === "")));
        renderPrefSelect(); renderPrefGrid(); update();
      }
      setActive(b.dataset.id, true);
    });
    $("tickerToggle").addEventListener("click", (e) => {
      const paused = document.querySelector(".ticker").classList.toggle("paused");
      e.currentTarget.textContent = paused ? "流す" : "止める";
    });
    $("resetView").addEventListener("click", () => { map.closePopup(); fitAll(); });
  }
})();
