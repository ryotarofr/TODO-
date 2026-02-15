## 認証フロー
1. [Frontend] ボタンクリック → invoke("start_oauth", { provider: "google" })     
                                          │
2. [Rust]  PKCE verifier + challenge 生成
             ↓
3. [Rust]  127.0.0.1:<random_port> でローカルHTTPサーバー起動
             ↓
4. [Rust]  システムブラウザで認証URL を開く
             (redirect_uri = http://127.0.0.1:<port>/callback)
             ↓
5. [Browser → Provider]  ユーザーがGoogle/GitHubで認証
             ↓
6. [Provider → localhost]  コールバック ?code=xxx&state=yyy
             ↓
7. [Rust]  ローカルサーバーが code を受け取り、サーバーを停止
             ↓
8. [Rust]  code + PKCE verifier でトークン交換 (Provider API)
             ↓
9. [Rust]  ID Token を検証 (OIDC) → ユーザー情報取得
             ↓
10. [Rust]  トークンをセキュアストレージ(OS Keychain)に保存
             ↓
11. [Rust]  ユーザー情報を DB に upsert → Frontend に返す