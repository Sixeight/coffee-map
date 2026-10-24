# 新しい購入を追加する手順

このマップに載せるのは**通販（オンライン注文）で買ったコーヒー豆だけ**です。店頭やカフェで買った分は載せません。

## 最終チェック日

| 項目 | 日付 |
|---|---|
| メールを最後に確認した日 | 2026-10-24 |
| そのとき見つかった最新の注文日（メール） | 2026-09-17（MANLY COFFEE） |
| Notion だけにある最新の購入日 | 2026-10-17（nai） |

次に確認するときは、2026-09-17 より後の注文メールから見ます。確認が終わったらこの表を更新します。

## 1. 注文メールを探す

Gmail の 2 アカウントを読むだけにします（返信や整理はしません）。

- 検索語の例: `コーヒー 注文`、`珈琲 ご注文`、`焙煎`、`豆 ご購入`、`after:2026/09/17`
- 主な通販の差出人: STORES、BASE、Shopify、カラーミーショップ、楽天市場、各焙煎所の自社ショップ
- 「ご注文ありがとうございます」「注文確認」のメールを使います。発送通知しかない場合の扱いは下の「載せないもの」を見てください。
- メールの日時は UTC で届くことがあります。注文日は日本時間に直して `YYYY-MM-DD` で書きます。

## 2. 重複を確かめる

重複判定のキーは **「お店の `id` + 注文日 + 豆の名前」** です。

- 同じキーの購入がすでにあれば足しません。
- Notion の記録と注文メールが同じ購入を指しているときは 1 件にまとめ、`source` を `Notion+メール` にします。
- 日付が Notion とメールでずれているときは、`date` は Notion の日付のまま、メールの注文日を `orderDate` に入れます。
- 同じ日に別々に注文した場合（例: FILTER SUPPLY の 2023-06-27）は、豆が違えば別の購入として 2 件にします。
- 注文番号は判定に使ってもかまいませんが、`shops.json` には書きません。

## 3. 既存のお店に購入を足す

`public/data/shops.json` で該当するお店の `purchases` に 1 件足します。

```json
{ "date": "2026-11-03", "beans": ["Ethiopia Guji Natural 100g"], "source": "メール" }
```

あわせて、ファイル先頭の `updated` をその日の日付にします。

## 4. 新しいお店を足す

1. お店の公式サイト（特定商取引法の表記や店舗情報）で、焙煎所の所在地を確認します。
2. 国土地理院のジオコーディング API で座標を出します。

   ```sh
   curl -s "https://msearch.gsi.go.jp/address-search/AddressSearch?q=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("福井県福井市大手3-10-1"))')"
   ```

   `geometry.coordinates` は `[経度, 緯度]` の順です。
3. 小数第 3 位に丸めて `lat` / `lng` に入れます。`city` は市区町村までにして、番地は書きません。
4. `url` に公式サイトを入れます。オンラインショップが別のドメインにあれば `shopUrl` にも入れます（ポップアップの「オンラインショップ」ボタンになります）。
5. 座標を推測で入れてはいけません。

### 所在地がわからないお店（オンライン）

公式サイトや特商法表記で焙煎所の所在地が確認できないお店は、地図には置かず「オンライン」に入れます。一覧と地方フィルタの「オンライン」に出ます。

```json
{ "id": "example", "name": "EXAMPLE ROASTERS", "area": "online", "prefecture": "", "city": "", "lat": null, "lng": null,
  "url": "https://example.base.shop/", "purchases": [ ... ], "memo": "所在地が確認できないためオンラインに分類" }
```

あとで所在地がわかったら、`area` を消して `prefecture` / `city` / `lat` / `lng` を入れれば地図に移ります。

### 海外のお店

国名と都市を入れて「海外」として地図に置きます。初期表示は日本のままで、一覧や地方フィルタの「海外」から選ぶとその場所に移ります（日本の外では淡色の世界地図タイルに切り替わります）。

```json
{ "id": "example-uk", "name": "EXAMPLE COFFEE", "area": "overseas", "country": "イギリス", "prefecture": "", "city": "ロンドン",
  "lat": 51.535, "lng": -0.055, "url": "https://example.com/", "purchases": [ ... ] }
```

海外の座標は国土地理院 API では出ないので、OpenStreetMap の Nominatim（`https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1`）で地区単位の座標を出し、小数第 3 位に丸めます。

オンラインと海外のお店は、軒数・購入回数・豆の数には入りますが、都道府県の数（◯/47）には入りません。

項目の一覧は `README.md` の「お店を追加する」にあります。

## 載せないもの

- 器具: フィルター、ドリッパー、スケール、ケトルなど（豆と同じ店で買っていても器具の注文は載せません）
- 生豆
- 量販品: Amazon などで買う大手ブランドの豆（例: illy）
- コーヒー以外: ビール、食品など
- 発送通知だけのメール: 何を買ったか、どの店か特定できなければ載せません。注文メールや Notion で中身が特定できる場合だけ、`note` に「発送通知から追記」などと添えて載せます。
- 店頭やカフェでの購入

所在地がわからないお店は「オンライン」に、海外のお店は「海外」として載せます（上の 4 を参照）。

## 個人情報を載せない

公開サイトなので、次の情報は `shops.json` にもスクリーンショットにも入れません。

- 自分の氏名、住所、電話番号、メールアドレス
- 注文番号、金額、送料、支払い方法
- お店の番地

## 5. 再デプロイして確かめる

1. JSON の書式を確認します。

   ```sh
   python3 -m json.tool public/data/shops.json > /dev/null && echo ok
   ```

2. ローカルで表示を確認します（`python3 -m http.server 8000` → http://localhost:8000/ ）。
3. `deploy.md` の手順でデプロイします。`public/assets/` を変えたときは `public/index.html` の `?v=` の数字を上げます。
4. 本番の内容がローカルと同じか確かめます。

   ```sh
   for p in / /data/shops.json /assets/app.js /assets/style.css; do
     curl -s -o /dev/null -w "%{http_code} $p\n" "https://roaster-map.pages.dev$p"
   done
   curl -s "https://roaster-map.pages.dev/data/shops.json?t=$(date +%s)" | cmp - public/data/shops.json && echo same
   ```

5. https://roaster-map.pages.dev/ を開き、軒数・購入回数と新しいピンを目で確かめます。
6. 上の「最終チェック日」を更新します。
