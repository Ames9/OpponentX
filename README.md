# Opponent X

NFLの過去の試合スコアと統計から、対戦相手チームを当てるブラウザゲーム。

---

## ゲームの遊び方

1. **チームと年代を選ぶ** — 好きなNFLチーム（32チーム）と、対象シーズン（2016〜2025）を選択
2. **試合が出題される** — 選んだチームの過去の試合がランダムに表示
3. **ヒントを見ながら対戦相手を当てる**
   - ヒントLv1（最初から）: 選手成績（QB/RB/WRのスタッツ）
   - ヒントLv2（1ミス後）: TDプレーの説明文
   - ヒントLv3（2ミス後）: ホーム/アウェイ、シーズン・週番号
4. **3回ミスでゲームオーバー**。正解するとESPNの試合ページへのリンクが表示され、次の試合へ

---

## ファイル構成

```
OpponentX/
├── src/
│   ├── app/
│   │   ├── page.tsx        # ゲームロジック・UI（メインコンポーネント）
│   │   ├── layout.tsx      # ルートレイアウト
│   │   └── globals.css     # グローバルスタイル・Tailwindテーマ
│   ├── lib/
│   │   ├── constants.ts    # 32チームのカラー・ディビジョン情報
│   │   └── utils.ts        # ユーティリティ（cn関数）
│   └── data/
│       └── games.json      # 試合データ（2016〜2025年、2,761試合）
├── fetch_data.py            # nflverseからデータを取得・整形するスクリプト
├── teamcolorcode.csv        # チームカラーの参照CSV
└── public/                  # 静的アセット
```

---

## データ構造

`games.json` の1試合あたりのデータ例:

```json
{
  "gameId": "2016_16_DET_DAL",
  "season": 2016,
  "week": 16,
  "espnUrl": "https://...",
  "baseTeam": "DAL",
  "opponentTeam": "DET",
  "isHome": true,
  "hints": {
    "hint1_teamStats": {
      "baseTeam":     { "passYds": 212, "rushYds": 88, "turnovers": 1 },
      "opponentTeam": { "passYds": 190, "rushYds": 64, "turnovers": 2 }
    },
    "hint2_qByQ": {
      "baseTeam": [7, 3, 7, 6], "baseTotal": 23,
      "opponentTeam": [0, 7, 0, 6], "opponentTotal": 13
    },
    "hint2_tds": {
      "baseTeam": ["Dak Prescott 1-yd rush TD", "..."],
      "opponentTeam": ["Golden Tate 12-yd pass from Stafford", "..."]
    },
    "hint3_topPerformers": [
      { "team": "baseTeam", "position": "QB", "playerName": "Dak Prescott", "statLine": "24/35, 212 Yds, 1 TD" }
    ]
  }
}
```

---

## 技術スタック

| 分類 | 技術 |
|------|------|
| フレームワーク | Next.js (App Router) |
| UI | React 19 + TypeScript |
| スタイリング | Tailwind CSS v4 |
| アニメーション | Framer Motion v12 |
| アイコン | Lucide React |
| データ | JSON（クライアントサイド、バックエンドなし） |

---

## データ取得・更新 (fetch_data.py)

[nflverse](https://github.com/nflverse/nflverse-data) の公開データを使用。

```bash
pip install pandas pyarrow requests
python fetch_data.py
```

処理内容:
- 対象年: 2016〜2025
- ソース: `games.csv`（スケジュール）、`play_by_play_YYYY.parquet`（プレー詳細）、`player_stats_YYYY.parquet`（個人成績）
- 出力: `src/data/games.json`

---

## 開発・起動

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run start
```

---

## デザインシステム

ダークテーマ（slate-950ベース）。選択チームのカラーがCSSカスタムプロパティで動的に適用される。

| 変数 | 色 |
|------|----|
| `--color-background` | `#0f172a` (slate-950) |
| `--color-foreground` | `#f8fafc` (slate-50) |
| `--color-primary` | `#3b82f6` (blue-500) |
| `--color-accent` | `#22c55e` (green-500) |
| `--color-error` | `#ef4444` (red-500) |
