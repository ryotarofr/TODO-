# tebiki

AI エージェントオーケストレーション・ダッシュボード。
複数の AI エージェントをビジュアルに接続・実行し、ワークフローを構築するデスクトップアプリケーション。

## 特徴

- **ビジュアルパイプラインエディタ** — パネルをドラッグ＆ドロップで配置し、ポート接続で DAG ベースのワークフローを構築
- **マルチエージェントオーケストレーション** — 承認フロー付きの多段エージェント実行、autoChain による自動連鎖
- **5 種類のウィジェット** — Text / Visual (Chart・Table・Diagram) / AI / Folder / Object
- **リアルタイム更新** — WebSocket によるエージェント実行状況のライブ表示
- **テンプレートシステム** — ワークフローの保存・復元・スナップショット共有
- **Mermaid ダイアグラム** — ER 図・フローチャート等を自動レンダリング
- **ローカルファースト** — デスクトップネイティブでデータ主権を確保

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | SolidJS, TypeScript, Vite |
| デスクトップ | Tauri v2 |
| バックエンド | Rust (Axum), WebSocket |
| データベース | PostgreSQL 16 (Docker) |
| レイアウト | GridStack (48 カラム) |
| リッチテキスト | Lexical (lexical-solid) |
| ダイアグラム | Mermaid |
| LLM | Anthropic Claude API |
| コード品質 | Biome (フォーマット・リント) |

## 前提条件

- [Rust](https://rustup.rs/) (stable)
- [Bun](https://bun.sh/) (または npm)
- [Docker](https://www.docker.com/) (PostgreSQL 用)
- Tauri v2 の[システム依存パッケージ](https://v2.tauri.app/start/prerequisites/)

## セットアップ

```bash
# 依存パッケージのインストール
bun install

# PostgreSQL を起動
bun run db:up

# Tauri アプリとして起動
bun run tauri dev
```

## 開発コマンド

```bash
# フロントエンド開発サーバー (Vite)
bun run dev

# Tauri デスクトップアプリとして起動
bun run tauri dev

# ビルド
bun run build          # フロントエンドのみ
bun run tauri build    # デスクトップアプリ

# コード品質
bun run format         # Biome フォーマット
bun run lint           # Biome リント
bun run check          # フォーマット + リント + 自動修正

# データベース
bun run db:up          # PostgreSQL 起動
bun run db:down        # PostgreSQL 停止
bun run db:reset       # データベースリセット (データ削除)
```

## ディレクトリ構成

```
tebiki/
├── src/                     # SolidJS フロントエンド
│   ├── components/          # 再利用可能なコンポーネント
│   │   ├── lexical/         #   リッチテキストエディタ
│   │   ├── Sidebar/         #   サイドバーナビゲーション
│   │   └── TreeView/        #   ツリービュー
│   ├── pages/               # ページコンポーネント
│   │   ├── Dashboard.tsx    #   メインダッシュボード
│   │   └── dashboard/       #   ダッシュボード関連モジュール
│   ├── contexts/            # コンテキスト (認証等)
│   └── utils/               # ユーティリティ
├── src-tauri/               # Rust バックエンド
│   ├── src/
│   │   ├── auth/            #   OAuth・認証
│   │   ├── services/        #   ビジネスロジック
│   │   ├── llm/             #   LLM プロバイダー
│   │   ├── tools/           #   エージェント用ツール
│   │   ├── handlers.rs      #   HTTP ハンドラ
│   │   ├── ws.rs            #   WebSocket
│   │   └── db.rs            #   DB接続プール
│   └── migrations/          # SQLx マイグレーション
├── doc/                     # 技術ドキュメント
└── docker-compose.yml       # PostgreSQL
```

## アーキテクチャ

```
┌─────────────────────────────────────────────┐
│  SolidJS Frontend (TypeScript)              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ GridStack│ │ Lexical  │ │   Mermaid   │ │
│  │ Dashboard│ │ Editor   │ │  Diagrams   │ │
│  └────┬─────┘ └──────────┘ └─────────────┘ │
│       │  WebSocket / REST API               │
└───────┼─────────────────────────────────────┘
        │
┌───────┼─────────────────────────────────────┐
│  Tauri v2 + Axum Backend (Rust)             │
│       │                                     │
│  ┌────┴─────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Pipeline │ │  Agent   │ │    Tool     │ │
│  │  Engine  │ │ Service  │ │  Registry   │ │
│  └──────────┘ └────┬─────┘ └─────────────┘ │
│                    │                        │
│  ┌─────────────────┴──────────────────────┐ │
│  │         PostgreSQL (sqlx)              │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

