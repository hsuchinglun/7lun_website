---
title: SQL｜索引與查詢效能統整
sidebar_position: 4
tags: [SQL, 索引, 查詢效能]
date: 2026-07-29
slug: sql-index-and-query-performance
---

### 一、SQL 查詢變慢的時候，先看執行計畫

#### 1. 為什麼同一條 SQL，資料量一大就變慢

- 一條 SQL 寫得對，不代表它跑得快。資料量小的時候怎麼寫都感覺不出差異，資料一累積到十萬、百萬筆，同一條查詢就可能從幾毫秒變成好幾秒。
- 原因通常不是 SQL 寫錯，而是資料庫「找資料的方式」沒有效率。結果是對的，路線是慢的。
- 所以效能調校的第一步不是改 SQL，是先看清楚資料庫實際跑了哪些步驟。

  ![seq scan 查詢結果](/img/sql04-5.png)

:::note
**資料量才是索引存在的理由。** 三筆資料的表怎麼查都很快，索引的價值只有在資料夠多的時候才看得出來。
:::

#### 2. EXPLAIN ANALYZE 的用法

- 語法完全不變，只要在查詢最前面加上 `EXPLAIN ANALYZE`。資料庫一樣會實際執行這條查詢，但回傳的不是查詢結果，而是一份執行計畫報告。

  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM members WHERE level = 'VIP';

  -- 資料庫回傳的報告
  Seq Scan on members (cost=0.00..1.04 rows=2 width=15) (actual time=0.010..0.012 rows=2 loops=1)
    Filter: (level = 'VIP')
    Rows Removed by Filter: 1
  Planning Time: 0.045 ms
  Execution Time: 0.028 ms
  ```

- 這份報告在說的事：資料庫用整張表逐筆掃過的方式，掃了 3 筆資料，篩掉 1 筆不是 VIP 的，花了 0.028 毫秒。
- [線上SQL練習區](https://gonsakon.github.io/postgresql-gym/#/playground)

#### 3. 先認得三個關鍵字

| 關鍵字 | 意思 |
|---|---|
| `Seq Scan` | 從頭到尾一筆一筆掃過整張表。資料量小沒差，資料一多就會變慢 |
| `Index Scan` | 透過索引直接定位到需要的資料，不用整張表掃過一遍 |
| `Rows Removed by Filter` | 撈出來之後又被篩掉幾筆。數字大代表資料庫掃了一堆用不到的資料才找到答案 |

#### 4. 拆解第一行

| 畫面片段 | 代表什麼 |
|---|---|
| `Seq Scan on orders` | 逐筆掃描 `orders` 資料表 |
| `Bitmap Heap Scan on orders` | 已取得符合條件的位置，再回到 `orders` 讀取完整資料 |
| `cost=開始..總成本` | 執行前預估的成本單位，不是毫秒 |
| 第一組 `rows=...` | 執行前預估會找到幾筆 |
| `width=...` | 預估每筆結果平均占用多少 bytes |
| `actual time=第一筆..完成` | 實際取得第一筆到完成這個步驟的時間，單位是 ms |
| 第二組 `rows=...` | 實際找到幾筆 |
| `loops=...` | 這個步驟實際執行幾次 |

#### 5. 拆解其他行

| 畫面文字 | 代表什麼 |
|---|---|
| `Filter` | 逐筆檢查時使用的篩選條件 |
| `Rows Removed by Filter` | 因為不符合條件而被排除的資料筆數 |
| `Bitmap Index Scan on idx_xxx` | 有使用索引，先找出可能符合的資料位置 |
| `Index Cond` | 進入索引尋找時使用的條件 |
| `Recheck Cond` | 回到原始資料後，再確認一次查詢條件 |
| `Heap Blocks: exact=...` | 實際讀取了多少個精確命中的資料表區塊，不是資料筆數 |
| `Buffers: shared hit=...` | 從共用快取找到的資料區塊數 |
| `Buffers: shared read=...` | 這次需要另外讀取的資料區塊數 |
| `Planning Time` | 資料庫思考要走哪條查詢路線花的時間 |
| `Execution Time` | 實際執行完整查詢花的時間 |

- `Bitmap Index Scan` 和 `Bitmap Heap Scan` 通常成對出現，是先後兩個步驟。

  ```text
  Bitmap Index Scan
  先從 idx_orders_tracking_code 找到資料位置
   ↓
  Bitmap Heap Scan
  再回到 orders 取得完整訂單
  ```

:::info
養成習慣：先看執行計畫，再決定要不要調整查詢或加索引，不憑感覺猜。
:::

### 二、索引是什麼，為什麼會讓查詢變快

#### 1. 索引的本質是一份排好序的副本

- 建立索引之後，資料庫會另外生成一份依照某個欄位排好順序的副本，並記著每筆資料原本存放的位置。
- 查詢時先在這份排好序的副本裡快速定位，再回去原本的表拿完整資料。

  ```sql
  CREATE INDEX idx_bookings_member_id ON bookings (member_id);
  ```

  | SQL 片段 | 意思 |
  |---|---|
  | `CREATE INDEX` | 建立一份新的資料庫索引 |
  | `idx_bookings_member_id` | 索引名稱，慣例是 `idx_資料表_欄位` |
  | `ON` | 指定索引要建立在哪張資料表 |
  | `bookings` | 要加上索引的資料表名稱 |
  | `(member_id)` | 要整理的欄位，括號內可以放一個或多個欄位 |

#### 2. 為什麼會變快

- 拿查字典比喻：一本沒排序的書要找一個字只能從頭翻到尾，這是 `Seq Scan`；照順序排好的字典可以快速鎖定範圍，這是 `Index Scan`。
- 換成猜數字更有感：假設有 30 萬筆資料，要在 1 到 30 萬裡猜中一個數。
  - 從 1 開始一個一個猜，最差要猜 30 萬次。
  - 每次猜中間值，依「太大 / 太小」把範圍砍掉一半，大約只要 19 次（`log2(300000) ≈ 19`）。
- 索引讓資料庫能用類似不斷對半縮小範圍的方式定位，所以資料量越大，差距越明顯。

#### 3. 索引不只有一種型別

- **`CREATE INDEX` 沒有特別指定的話，建出來的都是 B-tree**。
- B-tree 的原理是「把值排成一個順序」，所以它只服務得了「能比大小」的查詢。
- 一旦查詢問的不是「大於小於」而是「包不包含」「有沒有重疊」「像不像」，B-tree 就無能為力，這時要換索引型別，用 `USING` 指定。

  | 型別 | 適合的資料與查詢 | 典型運算子 |
  |---|---|---|
  | B-tree | 能排序、比大小的一般欄位。預設值 | `=`、`<`、`>`、`BETWEEN`、`IN`、`IS NULL` |
  | Hash | 只做等值比對，且值很長（例如長網址） | 只有 `=` |
  | GIN | 一列裡塞了多個值：陣列、JSONB、全文檢索 | `@>`、`?`、`@@` |
  | GiST | 幾何、範圍型別，判斷相鄰或重疊 | `&&`、`<@`、`@>`、`<->` |
  | SP-GiST | 分佈不平均的資料：座標點、IP、字串前綴 | `<<`、`>>`、`~<=~` |
  | BRIN | 超大表，且資料寫入順序和欄位值高度相關 | `=`、`<`、`>` |

- 幾個實務上真的會用到的場景。

  ```sql
  -- GIN：JSONB 欄位的包含查詢
  CREATE INDEX idx_products_attrs ON products USING GIN (attributes);
  SELECT * FROM products WHERE attributes @> '{"color": "red"}';

  -- GiST：範圍型別的重疊判斷，例如檢查訂位時段有沒有撞期
  CREATE INDEX idx_reservations_period ON reservations USING GiST (period);
  SELECT * FROM reservations
  WHERE period && tstzrange('2026-08-01', '2026-08-03');

  -- BRIN：只會往後累加的時間欄位，表很大但索引可以極小
  CREATE INDEX idx_logs_created ON logs USING BRIN (created_at);
  ```

- 最實用的一個是模糊搜尋。`LIKE '%關鍵字%'` 因為前面是萬用字元，B-tree 完全用不上（排序幫不了「中間包含」），要靠 `pg_trgm` 擴充搭配 GIN。

  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  CREATE INDEX idx_users_name_trgm
  ON users USING GIN (name gin_trgm_ops);

  SELECT * FROM users WHERE name LIKE '%志明%';
  ```

- 選型別時的簡單判斷。
  - 欄位是單一的數字、字串、時間，查詢是等於或範圍，選 B-tree，也就是不用特別指定。
  - 欄位裡裝的是「一堆值」（陣列、JSONB、一整篇文章），選 GIN。
  - 欄位是範圍或座標，要問「重不重疊」「離多近」，選 GiST。
  - 表大到索引本身都嫌佔空間，而且資料是照時間一路往後寫的，選 BRIN。

:::note
BRIN 有個前提常被忽略：它記的是「每一段實體區塊裡的最小值和最大值」，所以只有當資料的實體排列順序跟欄位值一致時才有效。如果資料是隨機插入或大量更新過，BRIN 幾乎等於沒用。
:::

### 三、索引要建在哪些欄位

#### 1. 選擇性決定索引有沒有用

- 關鍵不是這個欄位常不常出現在 `WHERE` 裡，而是這個條件能篩掉多少資料，也就是**選擇性（selectivity）。**
  - 選擇性高：條件很稀有，符合的資料很少，例如 `member_id`、`email`、訂單編號。
  - 選擇性低：條件很常見，符合的資料很多，例如只有三種值的 `status`、性別、是否啟用。
- 選擇性太低的欄位建索引幫助不大：查完索引還是要撈出一大堆資料，資料庫甚至可能判斷直接整張表掃過去比較快，索引就會被略過不用。
- 常見的困惑：**索引建好了不等於會被用到。** 執行計畫裡如果還是 `Seq Scan`：
  - 索引建在不對的欄位。
  - 條件本來就篩不掉多少資料。

#### 2. 兩個條件一起查：複合索引與欄位順序

- 查詢常常同時有兩個條件。

  ```sql
  SELECT * FROM bookings WHERE member_id = 1 AND status = 'active';
  ```

- 如果只幫 `member_id` 建索引，資料庫確實能快速定位到這個會員的所有預約，但接下來還是得把這些資料一筆一筆撈出來，再用 `Filter` 篩掉 `status` 不是 `active` 的部分。執行計畫裡會看到 `Rows Removed by Filter` 數字偏大，代表索引還不夠精準。
- **複合索引（composite index）** 是同時把多個欄位一起建成一份索引。

  ```sql
  CREATE INDEX idx_bookings_member_status ON bookings (member_id, status);
  ```

- 這份索引的排法是先依 `member_id` 排序，同一個 `member_id` 底下再依 `status` 排序。資料庫可以一次定位到同時符合兩個條件的資料，不用先撈一批再篩。
- 欄位順序的判斷。
  - 把選擇性較高、篩得掉最多資料的欄位放在前面。索引是由左到右逐層縮小範圍，先用最能篩選的條件把範圍縮到最小，後面的條件才能在小範圍裡有效率地再篩一次。
  - 如果系統也會只用第一個欄位查（例如只查某位外送員的全部訂單），把那個欄位放前面就能同時照顧兩種查詢。

   ![LiveFit 複合索引](/img/sql04-6.png)

:::note
**複合索引的左前綴可以單獨使用。** 建了 `(member_id, status)` 之後，只用 `WHERE member_id = 1` 的查詢一樣吃得到這份索引，但只用 `WHERE status = 'active'` 就吃不到。
:::

#### 3. 只索引一部分：部分索引

- **部分索引（partial index）** 只索引符合特定條件的那些列，索引體積更小、維護成本更低。

  ```sql
  -- 只索引「還沒取消」的報名
  CREATE INDEX idx_bookings_user_active
  ON course_bookings (user_id)
  WHERE cancelled_at IS NULL;
  ```

- 適用時機是查詢幾乎總是帶著同一個固定的 `WHERE` 條件，而且這個條件只覆蓋整張表的一小部分。
- 資料庫知道索引裡的每一筆都必然符合那個條件，所以連 recheck 都可以省掉。

#### 4. 哪些欄位不用建索引

- 判斷該不該建，可以問自己三個問題
  - 這個欄位常出現在 `WHERE`、`ORDER BY`、`JOIN` 的條件裡嗎？很少被查詢的欄位建了也用不到。
  - 這個欄位的選擇性夠高嗎？只有兩三種值的欄位，建索引效果有限。
  - 這個欄位是不是主鍵？主鍵在建表時就自動附帶索引了。
- 被參照的表本身筆數很少（例如課程分類只有 3 筆），對應的外鍵欄位建索引意義也不大，因為值的種類太少，選擇性拉不起來。

### 四、排序與 JOIN 也吃索引

#### 1. 加速 ORDER BY 加 LIMIT

- 「取最新的 100 筆」這種查詢，如果排序欄位沒有索引，資料庫得先把整張表排序一次才能取出前 100 筆。即使只要 100 筆，也得先動到全部資料。

  ```sql
  SELECT * FROM bookings ORDER BY booked_at DESC LIMIT 100;

  CREATE INDEX idx_bookings_booked_at ON bookings (booked_at);
  ```

- 建了索引之後，資料庫有一份已經排好序的副本可以直接照順序讀，讀滿 100 筆就停下來。
- B-tree 索引可以反向掃描，所以建預設 `ASC` 的索引也能服務 `ORDER BY ... DESC` 的查詢。

- 圖片解釋

  ![索引查詢結果](/img/sql04-2.png)

#### 2. 加速 JOIN

- 多張表關聯時，用來對應的欄位（通常是外鍵）如果沒有索引，每配對一筆就要掃過整張表去找對應資料。

  ```sql
  SELECT members.name, bookings.*
  FROM members
  JOIN bookings ON members.id = bookings.member_id
  WHERE members.email = 'alice@example.com';
  ```

- 資料庫先找到這位會員（1 筆），接著拿她的 id 去 `bookings` 撈出所有預約。`bookings.member_id` 沒有索引就只能把 10 萬筆整個掃過一遍。
- 需要補索引的是外鍵那一方，被參照的主鍵（`members.id`）建表時就自帶索引，不用另外補。

- 圖片解釋

  ![join 查詢結果](/img/sql04-3.png)

#### 3. 多表查詢的慢點可能不只一個

- 一條 JOIN 查詢常常是 `WHERE` 條件卡在一張表，`JOIN` 對應欄位卡在另一張表。
- 修完一個地方之後要重跑 `EXPLAIN ANALYZE`，下一個慢點才會浮出來。

  | SQL 部分 | 正在做什麼 | 幫助它的索引 |
  |---|---|---|
  | `WHERE members.email = 'alice@example.com'` | 找特定信箱的會員 | `idx_members_email` |
  | `ON members.id = bookings.member_id` | 找該會員的所有預約 | `idx_bookings_member_id` |

- 圖片解釋

  ![多表查詢結果](/img/sql04-4.png)

### 五、索引失效：欄位被函式包住

#### 1. 典型情境

- `booked_at` 已經建好索引，現在想查某一天的預約紀錄。

  ```sql
  SELECT * FROM bookings WHERE DATE(booked_at) = '2026-07-01';
  ```

- 這條查詢完全用不到索引。索引裡存的是 `booked_at` 原本完整的時間戳記，不是被 `DATE()` 處理過的結果。
- 資料庫沒辦法拿索引去對應函式運算後的值，只能對每一筆資料都先算一次 `DATE(booked_at)` 再比對，等於整張表掃過一遍。

#### 2. 解法不是加索引，是換寫法

- 把查詢改寫成欄位維持原樣的形式，用時間範圍比較。

  ```sql
  SELECT * FROM bookings
  WHERE booked_at >= '2026-07-01 00:00:00'
    AND booked_at <  '2026-07-02 00:00:00';
  ```

  | 條件 | 意思 |
  |---|---|
  | `>= 2026-07-01 00:00:00` | 包含 7 月 1 日的開始 |
  | `< 2026-07-02 00:00:00` | 不包含 7 月 2 日的開始 |

- 查詢結果跟原本完全一樣，因為 `booked_at` 是時間戳記，「這一天」本來就等於這段左閉右開的區間。差別只在欄位沒有被函式包住，資料庫可以直接拿它去比對索引。

#### 3. 其他常見的失效寫法

| 失效寫法 | 改法 |
|---|---|
| `WHERE price * 1.1 = 100` | `WHERE price = 100 / 1.1`，讓欄位維持原樣 |
| `WHERE LOWER(name) = 'vip'` | 寫入時就統一大小寫，或改用符合原始資料的條件 |
| `WHERE DATE(created_at) = '2026-06-24'` | 改成時間範圍比較 |

#### 4. 為什麼不能乾脆對 DATE(created_at) 建索引

- PostgreSQL 允許建立運算式索引，但運算式必須是 IMMUTABLE，也就是同樣的輸入永遠得到同樣的結果。
- `created_at` 如果是 `TIMESTAMPTZ`，`DATE()` 轉出來的日期會隨資料庫的時區設定而變，不是固定結果，所以 PostgreSQL 會直接擋下來報錯。
- 這正是這類問題應該改寫查詢、而不是加索引的原因。

:::warning
`DATE` 和 `TIMESTAMP` 是不同型別。`DATE` 只有年月日（`2026-07-20`），`TIMESTAMP` 是年月日加上時分秒（`2026-07-20 08:10:00`）。時間欄位存的是後者，所以查某一天一定要轉成範圍，不能直接等於一個日期。
:::

### 六、索引的成本與維護

#### 1. 索引不是免費的

- 會佔用額外的儲存空間。
- 每次新增、修改、刪除資料，都要同步更新索引，會拖慢寫入速度。
- 所以要在「查詢變快」跟「寫入變慢、空間變大」之間取得平衡，挑真正常被查詢的欄位建。

:::warning
「乾脆每個欄位都建索引」是錯的做法。每多一個索引，所有寫入操作就多一份維護成本，而且用不到的索引只會佔空間，不會加速任何事。
:::

#### 2. 線上建索引：CONCURRENTLY

- 一般的 `CREATE INDEX` 會對整張表上 `SHARE` 鎖，效果是「讀得到，但寫不進去」。
  - `SELECT` 不受影響。
  - `INSERT`、`UPDATE`、`DELETE` 全部卡住排隊，直到索引建完。
- 開發環境的小表感覺不出來，但正式環境的百萬筆大表可能要建好幾分鐘甚至更久，這段期間等於整個功能寫入中斷。
- `CREATE INDEX CONCURRENTLY` 改上比較弱的鎖，不會擋住寫入。

  ```sql
  CREATE INDEX CONCURRENTLY idx_users_email ON users (email);
  ```

- 代價有四個，用之前要知道。
  - 它要掃兩次表，中間還得等既有交易結束，所以總時間比一般建法長得多。
  - 不能包在交易區塊裡。這點最容易踩到，多數 migration 工具預設會把每個 migration 包成一筆交易，直接跑會噴錯，需要另外設定關掉交易包裝。
  - 同一張表同時間只能有一個 `CONCURRENTLY` 建索引在跑。
  - 建到一半失敗（唯一鍵衝突、死結、手動中斷）不會自動清乾淨，會留下一個「無效索引」。
- 無效索引最麻煩的地方是它兩頭皆空：查詢不會用它，但每次寫入還是要維護它。所以失敗之後一定要自己收尾。

  ```sql
  -- 找出所有無效索引
  SELECT indexrelid::regclass AS index_name
  FROM pg_index
  WHERE indisvalid = false;

  -- 砍掉重來，DROP 也可以用 CONCURRENTLY 避免鎖表
  DROP INDEX CONCURRENTLY idx_users_email;
  ```

- 相關的還有 `REINDEX INDEX CONCURRENTLY`（PostgreSQL 12 之後），用來線上重建已經膨脹的索引，不用先砍再建。

:::warning
規則很單純：本機開發直接用 `CREATE INDEX`，正式環境的大表一律用 `CONCURRENTLY`。差別不在快慢，在於後者不會讓服務寫不進資料。
:::

#### 3. 找出沒被用到的索引

- 既然索引有成本，就要定期清掉沒用到的，才不會白白拖慢寫入。

  ```sql
  SELECT relname, indexrelname, idx_scan
  FROM pg_stat_user_indexes
  ORDER BY idx_scan ASC;
  ```

- `idx_scan` 長期都是 0，代表這個索引從來沒被查詢用到，可以評估 `DROP INDEX`。

### 七、實戰：W7 效能急救室（LiveFit）六張工單

- LiveFit 健身平台爆紅，平台資料庫目前有相當大量的資料（30 多萬筆會員、100 多萬筆報名資料...）。上個班次的工程師在下班前，將六張營運單位提出的效能工單交接過來，你的任務就是了解這些工單提到的查詢問題（速度慢），再嘗試優化調整來解決這六張工單的查詢問題。

#### 1. 資料表關聯圖

![LiveFit 資料表關聯圖](/img/sql04-1.png)

#### 2. 工單 1：客服查會員

- 情境：客服輸入會員 email 查資料需等好幾秒，客人都等到掛電話了...
- 狀況：目前每次查詢，都會把整張 30 萬筆的 users 資料表掃過一遍，才能找出條件符合的那一筆資料

  ```sql
  SELECT * FROM users WHERE email = 'user250000@livefit.tw';
  ```
- `email` 沒有索引，30 萬筆 `users` 整張掃過才找到那一筆。

- 解法：

  ```sql
  -- 工單 1：客服查會員
  CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
  ```

- 理由：email 幾乎每筆都不同，選擇性極高，是最典型該建索引的欄位。

#### 3. 工單 2：企業會員的課表打不開

- 情境：企業戶「喵喵物流」反映，打開團課課表時，畫面要轉好久
- 狀況：目前打開課表時，都會在 100 多萬筆報名資料裡，一筆一筆的過濾出這個企業會員「還沒取消」的紀錄

  ```sql
  SELECT * FROM course_bookings WHERE user_id = 1003 AND cancelled_at IS NULL;
  ```

- 103 萬筆報名裡逐筆過濾出這個企業會員還沒取消的紀錄。
- 只建單欄索引不夠：`user_id = 1003` 大約對到 6 萬筆，其中約 15%（約 9,000 筆）會被 `cancelled_at IS NULL` 用 `Filter` 篩掉，遠超過 1000。

- 解法：是複合索引

  ```sql
  -- 工單 2：企業會員的課表
  CREATE INDEX IF NOT EXISTS idx_bookings_user_cancelled
  ON course_bookings (user_id, cancelled_at);
  ```

- 理由：`user_id` 選擇性高放前面，`cancelled_at` 一起進索引之後，`IS NULL` 可以當成 `Index Cond` 在索引裡就完成，不用另外做一輪 `Filter`。

#### 4. 加分題：把工單 2 改成部分索引

- 索引裡只放還沒取消的那 85%，體積更小、寫入維護成本更低。

  ```sql
  -- 加分題：部分索引
  CREATE INDEX IF NOT EXISTS idx_bookings_user_active
  ON course_bookings (user_id)
  WHERE cancelled_at IS NULL;
  ```

- 兩個索引擇一保留就好。如果要用部分索引，記得把複合索引 `DROP` 掉，否則會留下一個沒被使用的索引。


#### 5. 工單 3：最新購買紀錄牆

- 情境：後台首頁要顯示最新 100 筆購買紀錄，但每次進來都會卡一下
- 狀況：目前如果要取得最新的 100 筆，資料庫就得先把整張 40 萬筆購買紀錄都排序過一遍

  ```sql
  SELECT * FROM credit_purchases ORDER BY purchase_at DESC LIMIT 100;
  ```

- `purchase_at` 沒有索引，40 萬筆要整個排序過一次才能取前 100 筆。

- 解法：

  ```sql
  -- 工單 3：最新購買紀錄牆
  CREATE INDEX IF NOT EXISTS idx_purchases_purchase_at
  ON credit_purchases (purchase_at);
  ```

- 理由：有排好序的索引之後，資料庫可以照順序讀滿 100 筆就停。

#### 6. 工單 4：首頁「進行中課程」

- 情境：首頁「進行中課程」區塊越來越慢（上個班次的工程師曾經在 start_at 加過索引，但因為沒有效果，所以就先刪除了）
- 狀況：目前每次都需把整張 15 萬筆的課程資料表掃過一遍，才能過濾出「現在正在進行」的那幾堂課程

  ```sql
  SELECT * FROM courses
  WHERE start_at <= TIMESTAMPTZ '2026-07-24 18:00:00+08'
    AND end_at   >  TIMESTAMPTZ '2026-07-24 18:00:00+08';
  ```

- 這題的關鍵線索是「上個班次的工程師曾經在 `start_at` 加過索引，但因為沒有效果所以刪掉了」。
- 兩個條件的選擇性差很多，15 萬堂課裡。

  | 條件 | 符合筆數 | 選擇性 |
  |---|---|---|
  | `start_at <= 現在` | 約 149,250 堂，幾乎是全部 | 極低 |
  | `end_at > 現在` | 約 950 堂（進行中 200 加未來課 750） | 高 |

- 解法：

  ```sql
  -- 工單 4：首頁「進行中課程」
  CREATE INDEX IF NOT EXISTS idx_courses_end_at ON courses (end_at);
  ```

- 理由：索引要建在篩得掉最多資料的欄位上。`start_at` 幾乎篩不掉任何資料，所以前一位工程師建了也沒效果，資料庫評估後直接略過索引。
- 剩下的 750 堂未來課會由 `start_at` 條件用 `Filter` 篩掉，750 小於 1000。

#### 7. 工單 5：上週開課課程的教練報名統計

- 情境：每週開會都需要看「上週開課課程」的教練報名數量，但查詢這張報表實在太慢，所以大家都會先去泡咖啡
- 狀況：目前這張報表要把課程、報名、會員三張資料表關聯，而資料量一大就會卡住。（導致查詢慢的狀況不只一個）  

  ```sql
  SELECT u.name, COUNT(*) AS bookings
  FROM courses c
  JOIN course_bookings b ON b.course_id = c.id
  JOIN users u ON u.id = c.user_id
  WHERE c.start_at >= TIMESTAMPTZ '2026-07-24 18:00:00+08' - interval '7 days'
    AND c.start_at <  TIMESTAMPTZ '2026-07-24 18:00:00+08'
    AND b.cancelled_at IS NULL
  GROUP BY u.name;
  ```

- 這題有兩個病灶，所以要建兩個索引。
  - `courses.start_at` 的範圍條件沒有索引，15 萬堂課整張掃。
  - `course_bookings.course_id` 這個 JOIN 對應欄位沒有索引，103 萬筆報名整張掃。
- 解法。

  ```sql
  -- 工單 5：上週開課課程的教練報名統計（需新增兩個索引）
  CREATE INDEX IF NOT EXISTS idx_courses_start_at
  ON courses (start_at);

  CREATE INDEX IF NOT EXISTS idx_bookings_course_cancelled
  ON course_bookings (course_id, cancelled_at);
  ```

- 理由。
  - `courses (start_at)` 讓「上週開課」這個範圍條件先把課程數縮小，資料庫才有機會選 nested loop，而不是把整張報名表拉去做 hash join。
  - `course_bookings (course_id, cancelled_at)` 除了讓 JOIN 走索引，也把 `cancelled_at IS NULL` 一起放進索引，`Rows Removed by Filter` 直接降到 0。
- `users.id` 是主鍵、自帶索引，不需要另外補。

#### 9. 工單 6：爆量日報名查詢（改寫題）

- 情境：上個班次工程師交接提到，已經加了 created_at 索引，但客服說查詢 6/24 週年慶那天的報名還是超慢
- 狀況：原因是這條查詢用不到已建立的索引，所以還是把整張資料表都掃過一遍（這張資料表不可再加索引，方向為改寫查詢）  

  ```sql
  SELECT count(*) AS total
  FROM course_bookings
  WHERE DATE(created_at) = DATE '2026-06-24';
  ```

- 前一位工程師已經建了 `idx_bookings_created ON course_bookings (created_at)`，但索引完全沒被用到。
- 這題不能再建任何索引（營運反映寫入已經夠慢），只能改寫查詢。
- 解法：

  ```sql
  SELECT count(*) AS total
  FROM course_bookings
  WHERE created_at >= TIMESTAMPTZ '2026-06-24 00:00:00+08'
    AND created_at <  TIMESTAMPTZ '2026-06-25 00:00:00+08';
  ```

- 理由。
  - `created_at` 被 `DATE()` 包住，索引裡存的是完整時間戳記而不是轉換後的日期，資料庫只能逐筆計算再比對。
  - 改成左閉右開的時間範圍之後，欄位維持原樣，現有的 `idx_bookings_created` 就能派上用場。
  - 結果完全一致：資料庫時區設定為 `Asia/Taipei`，`DATE(created_at) = '2026-06-24'` 的範圍就是台北時間 6/24 當天 00:00 到 6/25 00:00 之前。邊界明確寫上 `+08`，本機和 CI 跑出來的結果都會一樣。



### 八、資料來源

- [🏅 Day 27 - 資料庫如何跑你的查詢（EXPLAIN ANALYZE）](https://hackmd.io/OQ3ShMMuTCe4-5oIwZXNWA?view)
- [🏅 Day 28 - 索引是什麼，為什麼會讓查詢變快](https://hackmd.io/yrFZKFPyRt2g-14Bq5FHcQ?view)
- [🏅 Day 29 - 複合索引與選擇性，如何把索引建立正確](https://hackmd.io/7-2HE3yzQIiTX-7Wu6vbyw?view)
- [🏅 Day 30 - 索引的其他用途：排序、JOIN 與「不用建立」的判斷](https://hackmd.io/Mc6fCa4eR2mcB-iPr0-rCg?view)
- [🏅 Day 31 - 索引失效的時候](https://hackmd.io/xtDzUP-wQiWL0oZ-f5-d6Q?view)
- [第七堂：資料庫進階概念與效能（六角學院 Week 7 講義）](https://hackmd.io/_17o6B_mTYKbTh0_Zt0EEg?view)
- [hexschool/node-js-week7-2026 作業專案](https://github.com/hexschool/node-js-week7-2026)
- [PostgreSQL Documentation: 11.2. Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [PostgreSQL Documentation: 11.9. Index-Only Scans and Covering Indexes](https://www.postgresql.org/docs/current/indexes-index-only-scans.html)
- [PostgreSQL Documentation: CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)
- [PostgreSQL Documentation: pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html)



