# 7LUN Chapter

> Every project starts a new chapter — 記錄每一段前端開發的篇章。

一個以 [Docusaurus v3](https://docusaurus.io/) 建構的個人技術網站，採「報紙／編輯風」視覺設計，用來整理前端學習筆記、記錄專案開發歷程，以及展示個人作品集。

🌐 **網站連結**：[https://www.7lunchapter.com](https://www.7lunchapter.com)

---

## 目錄

- [網站內容](#網站內容)
- [語法 Notes 分類](#語法-notes-分類)
- [特色](#特色)
- [技術棧](#技術棧)
- [專案結構](#專案結構)
- [本地開發](#本地開發)
- [部署](#部署)

---

## 網站內容

| 頁面     | 說明                                                     |
| -------- | -------------------------------------------------------- |
| 首頁     | 個人介紹、技能索引、作品預覽、最新筆記、合作回饋         |
| 關於     | 主視覺 hero、轉職路徑時間線、專注技術、理念              |
| 語法 Notes | HTML / CSS / JavaScript / React / Vue / Nuxt / Node.js / SQL 學習筆記 |
| 部落格 Blog | 前端專案開發紀錄                                       |
| 作品 Portfolio | 團隊協作、個人專案、後端工具與互動式學習等作品展示 |

---

## 語法 Notes 分類

| 分類       | 篇數   |
| ---------- | ------ |
| HTML / CSS | 18     |
| JavaScript | 18     |
| React      | 7      |
| Vue        | 7      |
| Nuxt       | 1      |
| Node.js    | 8      |
| SQL        | 4      |
| Git        | 3      |

> 文章 frontmatter 加上 `date: YYYY-MM-DD` 即會被「最新筆記」外掛收錄，顯示在首頁目錄區。

---

## 特色

- **編輯風視覺**：報紙刊頭式 Navbar（每日自動帶當天日期 + 期數 No.7）、雙線分隔、暖咖啡色系（主色 `#6f4e37`）
- **站內搜尋**：本地全文搜尋（`@easyops-cn/docusaurus-search-local`），支援中英斷詞；桌機放在刊頭 NO.7 旁，手機收進選單抽屜頂端
- **客製文章排版**：建立日期 dateline、置中欄寬、暖底程式碼區塊、內文超連結加粗；部落格與語法文章版面、標題字級一致
- **最新筆記外掛**：建置期掃描 docs frontmatter，自動取最新 3 篇顯示於首頁
- **集中管理**：頁面標題與 SEO 描述統一在 `src/constants.js`，改一處即同步全站
- **響應式設計**：手機 / 平板 / 桌機皆有針對性 RWD 調整
- **字體**：標題中英統一 Noto Serif TC、內文 Inter + Noto Sans TC、程式碼 JetBrains Mono
- **圓形 favicon**：以 SVG 圓形裁切 logo

---

## 技術棧

- **框架**：[Docusaurus v3](https://docusaurus.io/)（v3.10）
- **語言**：JavaScript / MDX / CSS
- **搜尋**：[@easyops-cn/docusaurus-search-local](https://github.com/easyops-cn/docusaurus-search-local)
- **部署**：Vercel（同時保留 GitHub Pages 部署設定）
- **字體**：Inter / Noto Sans TC / Noto Serif TC / JetBrains Mono

---

## 專案結構

```
.
├── docs/                  # 語法 Notes 筆記（依分類資料夾，含 _category_.json）
├── blog/                  # 部落格 Blog / 專案作品文章
├── plugins/
│   └── recent-docs/       # 自製外掛：抓取最新筆記
├── i18n/zh-Hant/          # 語系覆蓋（blog 標題、側欄標題等）
├── src/
│   ├── pages/             # 首頁 / 關於 / 作品（*.js + *.module.css）
│   ├── constants.js       # 全站頁面標題與 SEO 描述集中管理
│   ├── components/        # ManualIndex 等
│   ├── theme/             # swizzle 客製：Navbar 刊頭＋搜尋、MobileSidebar 抽屜搜尋、
│   │                      #   DocItem dateline、DocCard、BlogListPage
│   ├── css/custom.css     # 全站主題與排版
│   └── clientModules/     # 前端載入時執行的腳本
├── static/img/            # 圖片資源（logo、logo-round.svg、og-image、配圖）
├── docusaurus.config.js   # 站台設定（標題、外掛、navbar、search、prism 主題等）
```

---

## 本地開發

```bash
# 安裝套件
npm install

# 啟動開發伺服器（http://localhost:3000）
npm start

# 建置生產版本到 build/
npm run build

# 本機預覽 build 結果
npm run serve

# 清除快取（排版／設定改了卻沒更新時）
npm run clear
```

> 注意：站內搜尋的索引在 `npm run build` 時才產生，開發模式（`npm start`）下搜尋無結果屬正常，需以 `npm run build` + `npm run serve` 測試。新增 swizzle 元件後也需重啟 `npm start` 才會載入。

---

## 部署

網站部署於 Vercel，推送至預設分支後會自動建置上線。

若要改用 GitHub Pages 部署（推送到 `gh-pages` 分支）：

```bash
GIT_USER=MalricHsu npm run deploy
```

執行後會自動建置並推送，稍等幾分鐘即可看到更新。
