# 通販で買ったコーヒー豆のお店マップ

**通販購入のみ記録**しています。オンラインショップで豆を買ったコーヒー焙煎所を地図にまとめた静的サイトです。店頭やカフェで買った分は記録しません。焙煎所の所在地がわからないお店は「オンライン」（地図にピンなし）、海外のお店は「海外」として載せます。

新しく通販で買ったときの追記手順は [`UPDATE.md`](UPDATE.md) にあります。

ビルドは要りません。このフォルダをそのまま配信すれば動きます。

## ファイル構成

```
coffee-map/
├── index.html          ページ本体
├── data/shops.json     お店と購入記録のデータ（追記するのはここだけ）
├── assets/style.css    見た目
├── assets/app.js       地図・一覧・絞り込みの処理
├── assets/favicon.svg
├── _headers            Cloudflare Pages 用のキャッシュ設定（任意）
└── README.md
```

外部から読み込むもの: Leaflet 1.9.4（unpkg）、Noto Sans JP / Noto Serif JP（Google Fonts）、国土地理院の淡色地図タイル、Esri World Light Gray Canvas（日本が画面に入らないときだけ使う世界地図タイル）。

## ローカルで見る

`fetch` で JSON を読むので、ファイルをダブルクリックで開くのではなく簡易サーバーを使います。

```sh
cd coffee-map
python3 -m http.server 8000
# http://localhost:8000/ を開く
```

## お店を追加する

`data/shops.json` の `shops` 配列に 1 件足します。並び順は自由です（表示時に並べ替えます）。

```json
{
  "id": "example",
  "name": "EXAMPLE COFFEE ROASTERS",
  "prefecture": "福井県",
  "city": "福井市",
  "lat": 36.065,
  "lng": 136.222,
  "url": "https://example.com/",
  "shopUrl": "https://example.stores.jp/",
  "purchases": [
    {
      "date": "2026-11-03",
      "beans": ["Ethiopia Guji Natural 100g", "Kenya AA Washed 100g"],
      "note": "華やかで好み",
      "source": "メール"
    }
  ],
  "memo": "任意",
  "recordedAs": "任意。Notion 上の表記が実際と違うときの注記など"
}
```

| 項目 | 必須 | 説明 |
|---|---|---|
| `id` | ○ | 半角英数字の重複しない識別子。URL の `#id` で、そのお店を開いた状態にできます |
| `name` | ○ | 店名 |
| `prefecture` | ○ | 所在地の都道府県（「県」「府」「都」まで書く。北海道は「北海道」）|
| `city` | ○ | 市区町村まで。番地は書かない |
| `lat`, `lng` | ○ | 緯度経度。小数第 3 位（約 100 m）に丸める |
| `url` | ○ | 公式サイト |
| `shopUrl` | | 公式と別にオンラインショップがあれば |
| `purchases` | ○ | 購入ごとに 1 件。`date` は `YYYY-MM-DD`（不明なら `null`）、`beans` は豆の名前の配列、`note` は感想など |
| `purchases[].dateNote` | | 日付に添える注記（例:「県の達成日」）|
| `purchases[].source` | | 出典。`Notion` / `メール` / `Notion+メール` のどれか。ポップアップに「出典」として出ます |
| `purchases[].orderDate` | | Notion の日付と注文メールの日付が違うときの、メール側の注文日（`YYYY-MM-DD`）|
| `recordedAs` | | 補足。ポップアップの下に小さく出ます |
| `area` | | `online`（所在地不明。地図に置かず `lat`/`lng` は `null`）か `overseas`（海外）。国内のお店には付けない |
| `country` | | 海外のお店の国名（`area: "overseas"` のとき）|

通販で買った豆だけを載せます。同じお店でまた買ったときは、その店の `purchases` に 1 件足すだけです。ピンに購入回数が付きます。

### 座標の調べ方

1. お店の公式サイト（特定商取引法の表記や店舗情報）で住所を確認する。
2. 国土地理院のジオコーディング API で座標を出す。

   ```sh
   curl -s "https://msearch.gsi.go.jp/address-search/AddressSearch?q=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("福井県福井市大手3-10-1"))')"
   ```

   返ってくる `geometry.coordinates` は `[経度, 緯度]` の順です。
3. 小数第 3 位に丸めて `lat` と `lng` に入れる。

座標は推測で入れないでください。住所が確認できないお店は `area: "online"` にして、地図に置かずに載せます。

保存したら `python3 -m json.tool data/shops.json > /dev/null` で JSON の書式を確認できます。

## 載せないもの

公開サイトなので、次の情報は `shops.json` に入れません。

- 自分の住所・電話番号・メールアドレス
- 注文番号、金額、送料、支払い方法
- お店の番地（個人宅を兼ねた焙煎所もあるため。市区町村までにして座標も丸める）

## Cloudflare Pages で公開する

- フレームワーク: なし
- ビルドコマンド: 空欄
- 出力ディレクトリ: リポジトリ内のこのフォルダ（ルートに置くなら `/`）

Workers の static assets で配信する場合も、このフォルダを assets のディレクトリに指定すれば動きます。`_headers` は Pages 用の任意ファイルです。

`data/shops.json` を更新したあとブラウザに古い内容が残るときは、再読み込みしてください（`_headers` で 5 分キャッシュにしています）。`assets/` を書き換えたときは、`index.html` の `?v=8` の数字を上げるとすぐ反映されます。

公開中: https://coffee-map-nishimu.pages.dev/ 。再デプロイの手順は `deploy.md` にあります。
