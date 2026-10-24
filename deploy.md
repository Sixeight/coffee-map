# デプロイ手順（Cloudflare Pages）

- **プロジェクト:** `coffee-map-nishimu`（本番ブランチ `main`）
- **本番 URL:** https://coffee-map-nishimu.pages.dev/
- **アカウント ID:** `<CLOUDFLARE_ACCOUNT_ID>`（実際の値は box の `deploy/cloudflare-account-id.local` にあり、Git には入れない）

wrangler も Git 連携も使っていません。Cloudflare のコネクタ（`user-Cloudflare` の `execute`）から API で直接アップロードしています。

## 店を追加したあとの再デプロイ

1. `data/shops.json` を編集し、書式を確認する。

   ```sh
   cd /workspace/coffee-map
   python3 -m json.tool data/shops.json > /dev/null && echo ok
   ```
2. 必要ならローカルで見た目を確かめる。`python3 -m http.server 8000` を起動して http://localhost:8000/ を開く。
3. デプロイ用のコードを生成する。初回だけ `npm i` が要ります。

   ```sh
   cd /workspace/coffee-map/deploy
   npm i --silent          # 初回のみ（blake3-wasm）
   node build-payload.mjs coffee-map-nishimu main worker > /tmp/cf-deploy.js
   ```
4. コネクタの `execute` に、生成したファイルをそのまま渡す。

   ```json
   { "account_id": "<CLOUDFLARE_ACCOUNT_ID>", "code": "$file:/tmp/cf-deploy.js" }
   ```

   戻り値の `url` は、そのデプロイ固有の URL です。本番の `coffee-map-nishimu.pages.dev` も数十秒で切り替わります。
5. 公開されたことを確認する。

   ```sh
   for p in / /data/shops.json /assets/app.js /assets/style.css; do
     curl -s -o /dev/null -w "%{http_code} $p\n" "https://coffee-map-nishimu.pages.dev$p"; done
   curl -s https://coffee-map-nishimu.pages.dev/data/shops.json | cmp - data/shops.json && echo 最新
   ```

`assets/` の CSS や JS を変えたときは、`index.html` の `?v=8` の数字を上げてください。ブラウザのキャッシュ（1 日）を飛ばせます。`shops.json` のキャッシュは 5 分です。

## しくみ（なぜ `_worker.js` なのか）

通常の Direct Upload では、次の順に API を呼びます。

1. `GET /accounts/{id}/pages/projects/{name}/upload-token` で JWT をもらう。
2. その JWT で `/pages/assets/check-missing`、`/upload`、`/upsert-hashes` を呼ぶ。
3. `POST .../deployments` に manifest を付けて送る。

ところがコネクタの実行環境から呼ぶと、手順 2 が毎回 `403 Authorization failed`（code 8000013）になります。外向き通信の認証がコネクタ側のものに差し替わるためとみられます。

そこで `build-payload.mjs` の `worker` モードでは、別の方法を取っています。

- 公開するファイル（`index.html`、`assets/*`、`data/shops.json`）を 1 つの Pages `_worker.js` に埋め込む。
- `manifest: {}` と一緒に `deployments` へ multipart で POST する。
- `_headers` の内容（キャッシュ設定と `nosniff`）は worker が同じ規則で付ける。
- ETag は wrangler と同じハッシュ（`blake3(base64(中身) + 拡張子)` の先頭 32 文字）を使う。
- `README.md`、`deploy.md`、`deploy/` は公開しない（アクセスすると 404）。

Pages Functions の無料枠（1 日 10 万リクエスト）を使いますが、このサイトの規模なら問題ありません。

### wrangler が使える環境なら

API トークンを用意できれば、普通の静的アセットとして出せます。`_headers` は Pages がそのまま解釈します。

```sh
CLOUDFLARE_ACCOUNT_ID=<CLOUDFLARE_ACCOUNT_ID> \
npx wrangler pages deploy . --project-name coffee-map-nishimu --branch main
```

このとき README などを公開したくなければ、公開用のフォルダに `index.html`、`assets/`、`data/`、`_headers` だけをコピーして、そのフォルダを指定します。`build-payload.mjs ... assets` も標準の Direct Upload フローを出力しますが、JWT が通る環境でしか動きません。

## 独自ドメイン（未設定）

`coffee.nishimu.land` などを使うときは、次の 2 つが要ります。

- Pages プロジェクトの「カスタムドメイン」に追加する（API なら `POST /accounts/{id}/pages/projects/coffee-map-nishimu/domains`）。
- DNS 側（Route 53）で `coffee` の CNAME を `coffee-map-nishimu.pages.dev` に向ける。

まだどちらもしていません。
