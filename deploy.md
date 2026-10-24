# デプロイ

- **公開URL:** https://roaster-map.nishimu.land/
- **方式:** Cloudflare Pages の GitHub 連携。`main` に push すると Cloudflare が自動で公開する。
- **ビルド設定:** フレームワークなし、ビルドコマンドなし、出力ディレクトリ `public`。

Cloudflare Pages のプロジェクトは `roaster-map`（デフォルトドメイン roaster-map.pages.dev）。カスタムドメイン roaster-map.nishimu.land は nishimu.land の Route 53 ゾーンに、roaster-map.pages.dev を指す CNAME として設定している。

## 更新の流れ

1. `public/data/shops.json` を編集し、書式を確認する。

   ```sh
   python3 -m json.tool public/data/shops.json > /dev/null && echo ok
   ```

2. コミットして `main` に push する。
3. 1〜2 分待ってから、本番に反映されたか確かめる。

   ```sh
   curl -s "https://roaster-map.nishimu.land/data/shops.json?t=$(date +%s)" | cmp - public/data/shops.json && echo 最新
   ```

`public/assets/` の CSS や JS を変えたときは、`public/index.html` の `?v=` の数字を上げてください。ブラウザのキャッシュ（1 日）を飛ばせます。`shops.json` のキャッシュは 5 分です（`public/_headers`）。

`public/` の外（README など）は公開されません。
