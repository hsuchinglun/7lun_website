---
title: SQL｜資料表基礎與 SQL 查詢語法
sidebar_position: 2
tags: [PostgreSQL, SQL, 資料庫, 知識點筆記]
date: 2026-07-11
slug: sql-table-fundamental-and-query-syntax
---

### 一、為什麼需要資料庫

#### 1. 從記憶體陣列的痛點講起

- 在還沒接觸資料庫前，我們通常會將資料儲存在記憶體陣列中。`const members = [...initialMembers]`。這是一種暫時性的儲存方式，實際上會遇到以下三個問題：
  - **重啟伺服器，資料全部消失**：`node app.js` 一重開，`members` 陣列就回到初始值，新增過的資料通通不見。
  - **改存 JSON 檔案？兩個 request 同時寫檔會互相蓋資料**，也沒辦法「只查符合條件的」，每次都得整包讀進來自己 `filter`。
  - 真實世界的解法：把資料交給一個**專門管資料的程式**資料庫。

    | | in-memory 陣列 / JSON 檔 | 資料庫 |
    | --- | --- | --- |
    | 重開 server | 資料消失 | 資料還在 |
    | 條件查詢 | 整包讀出來自己 filter | 一行指令，資料庫幫你找 |
    | 同時寫入 | 會互相蓋掉 | 資料庫排隊處理，不會打架 |

#### 2. 什麼是資料庫、什麼是 SQL

- 常見資料庫種類：MySQL、MS SQL、**PostgreSQL**，操作邏輯很接近操作 Excel。
- 各家資料庫共用的操作指令叫 **SQL（Structured Query Language，結構化查詢語言）**，語法大同小異。


### 二、資料表的基本結構

#### 1. 沒有結構的資料 vs 表格化資料

- **沒有結構的資料**：每筆資料的格式都不一樣，程式沒辦法讀、也沒辦法查。
  ```text
  王小明(男) - 住台北市 電話：0912-345-678 備註：常客，VIP會員
  李美玲小姐 性別=女 地址：台北市松山區 Email: lee@example.com 其他：1990年5月15日生
  ```

- **表格化資料**：表格化之後才有辦法用固定的欄位存取。
  | 名詞 | 是什麼 | 對照 Excel |
  | --- | --- | --- |
  | 資料表（Table） | 一整組相關資料 | 一張工作表 |
  | 欄位（Column） | 資料的屬性＋型態 | 直的一欄（姓名、電話…） |
  | 資料列（Row） | 一筆完整資料 | 橫的一列（王小明那一列） |

#### 2. 建立順序

```text
資料庫 → 資料表 → 定義欄位 → 塞入資料列
```

- 以下是一張 `members` 資料表，之後 WHERE、ORDER BY、UPDATE／DELETE 都會沿用它：

  | id | name | email | level | city | credits |
  | --- | --- | --- | --- | --- | --- |
  | 1 | Alice | `alice@example.com` | VIP | 台北 | 520 |
  | 2 | Bob | `bob@example.com` | 一般 | 台中 | 80 |
  | 3 | Charlie | `charlie@example.com` | VIP | 高雄 | 310 |
  | 4 | Diana | `diana@example.com` | 一般 | 台北 | 350 |
  | 5 | Eve | `eve@example.com` | VIP | 台南 | 490 |


### 三、建立資料表與資料型態（CREATE TABLE）

#### 1. CREATE TABLE 語法

```sql
CREATE TABLE members (
  id INT PRIMARY KEY,       -- 主鍵，每一列的唯一識別碼
  name VARCHAR(50),         -- 姓名（字串，最長 50 字元）
  email VARCHAR(100),       -- 電子郵件
  level VARCHAR(20),        -- 會員等級
  city VARCHAR(50),         -- 居住城市
  credits INT                -- 積分
);
```

> 指令最後要加分號「;」結束整句 SQL。

#### 2. 常見資料型態對照表

| 資料型態 | 描述 | 使用情境 | 範例欄位 |
| --- | --- | --- | --- |
| `INTEGER` | 整數 | 年齡、數量、積分 | `age INTEGER` |
| `VARCHAR(n)` | 可變長度字串 | 名稱、描述 | `name VARCHAR(50)` |
| `TIMESTAMP` | 日期時間 | 建立／更新時間 | `created_at TIMESTAMP` |
| `DECIMAL(p,s)` / `NUMERIC(p,s)` | 精確小數 | 金額計算 | `price DECIMAL(10,2)` |
| `BOOLEAN` | 真／假值 | 狀態、開關 | `is_active BOOLEAN` |

:::note
欄位規定是數字就塞不進文字，資料庫用型態保護資料正確性。PostgreSQL 官方文件建議 `INTEGER` 是泛用整數型態的預設選擇，在範圍、儲存空間與效能間取得平衡；若欄位牽涉**金額**、需要精確到小數，官方文件明確建議改用 `NUMERIC`／`DECIMAL`，因為 `REAL`／`DOUBLE PRECISION` 屬於浮點數，儲存或計算時可能出現微小誤差。
:::


### 四、INSERT 新增資料

#### 1. 語法

```sql
INSERT INTO 資料表 (欄位1, 欄位2, ...) VALUES (值1, 值2, ...);
```

- 欄位與值要一一對應，**字串加單引號、數字不加**。

#### 2. 單筆與多筆

```sql
-- 單筆
INSERT INTO members (id, name, email, level, city, credits)
VALUES (6, 'Frank', 'frank@example.com', '一般', '新竹', 120);

-- 多筆：用逗號分隔多組 VALUES
INSERT INTO members (id, name, email, level, city, credits) VALUES
  (1, 'Alice', 'alice@example.com', 'VIP', '台北', 520),
  (2, 'Bob', 'bob@example.com', '一般', '台中', 80);
```

### 五、SELECT 查詢資料

#### 1. 基本句型

```sql
SELECT 欄位 FROM 資料表;
```

`SELECT *` 代表「所有欄位都要」，會回傳整張表的每一筆資料。

#### 2. 全部欄位 vs 指定欄位

```sql
-- ① 全部欄位
SELECT * FROM members;

-- ② 只要姓名和等級
SELECT name, level FROM members;
```

- **注意：**

  - 欄位名稱要拼對，拼錯會直接報錯。
  - 欄位的**順序要跟需求一致**，`SELECT name, level` 與 `SELECT level, name` 回傳的欄位順序不同。

:::warning
生產環境的查詢盡量避免 `SELECT *`。PostgreSQL 官方文件也特別提醒，`SELECT *` 雖然方便，但正式程式碼裡通常視為不好的寫法，因為之後只要資料表新增欄位，回傳的結果就會跟著變動，容易讓前後端邏輯出乎意料。這跟後端 API 設計「只回傳需要的欄位」是同一個道理。
:::

#### 3. AS 別名與現場運算

- 欄位可以現場運算，`AS` 幫結果取個好讀的名字（原表不會被改動）：

  ```sql
  SELECT
    name AS 姓名,
    credits AS 目前積分,
    credits * 2 AS 雙倍積分預估
  FROM members;
  ```

### 六、WHERE 條件篩選

#### 1. 語法位置

- `WHERE` 放在 `FROM` 後面，用來告訴資料庫「我只要符合這個條件的資料」，沒有 `WHERE` 就會撈出**全部**資料：

  ```sql
  SELECT 欄位 FROM 資料表 WHERE 條件;
  ```

#### 2. 值的型別：字串加引號，數字不加

```sql
SELECT * FROM members WHERE level = 'VIP';      -- 字串要加單引號
SELECT * FROM members WHERE credits >= 300;      -- 數字不加引號
```

:::warning
數字欄位如果不小心加了引號（例如 `credits >= '300'`），會被當成字串比較，可能得到不是你要的排序或篩選結果。這跟 Express 筆記裡「`req.query` 拿出來的值一律是字串，運算前記得 `Number()` 轉型」是同一類地雷：SQL 跟 JS 都要求你對「型別」保持敏感。
:::

#### 3. 比較運算子

| 運算子 | 意義 |
| --- | --- |
| `=` | 等於 |
| `!=` | 不等於 |
| `>` / `<` | 大於 / 小於 |
| `>=` / `<=` | 大於等於 / 小於等於 |

#### 4. 邏輯運算子：AND / OR

```sql
-- 是 VIP 且積分 >= 300
SELECT * FROM members WHERE level = 'VIP' AND credits >= 300;

-- 在台北 或 在高雄
SELECT * FROM members WHERE city = '台北' OR city = '高雄';
```

#### 5. 集合與範圍：IN / BETWEEN

```sql
-- city 在指定清單內
SELECT * FROM members WHERE city IN ('台北', '台中');

-- credits 介於 100 到 400 之間（含頭含尾）
SELECT * FROM members WHERE credits BETWEEN 100 AND 400;
```


### 七、ORDER BY 排序與 LIMIT 限制筆數

#### 1. ASC / DESC

`ORDER BY` 放在 `WHERE` 後面，指定要依哪個欄位排序：

- `ASC`：由小到大（預設值，可省略）
- `DESC`：由大到小

```sql
-- 依積分由高到低排列
SELECT * FROM members ORDER BY credits DESC;
```

#### 2. LIMIT 取前幾筆

`LIMIT N` 放在語句最後，限制只回傳前 N 筆資料，搭配 `ORDER BY` 就能做出「排行榜」：

```sql
-- 積分前三高
SELECT name, credits FROM members ORDER BY credits DESC LIMIT 3;
```

#### 3. 子句撰寫順序

SQL 子句有固定的撰寫順序，寫錯位置會直接報錯：

```sql
SELECT 欄位
FROM 資料表
WHERE 條件
ORDER BY 欄位 ASC|DESC
LIMIT 筆數;
```


### 八、UPDATE / DELETE 修改與刪除資料

前面的 `SELECT` 都是「讀」資料，`INSERT`、`UPDATE`、`DELETE` 則對應後端 API 裡 `POST`、`PUT/PATCH`、`DELETE` 背後實際執行的 SQL。

#### 1. 語法

```sql
-- 修改
UPDATE 資料表 SET 欄位 = 新值 WHERE 條件;

-- 刪除
DELETE FROM 資料表 WHERE 條件;
```

同時修改多個欄位用逗號分隔：

```sql
-- 把 id = 2 的會員積分改為 300
UPDATE members SET credits = 300 WHERE id = 2;

-- 同時改 level 與 credits
UPDATE members SET level = 'VIP', credits = 500 WHERE id = 4;

-- 刪除 id = 6 的會員
DELETE FROM members WHERE id = 6;
```

#### 2. 保命習慣：一定要加 WHERE

```sql
-- ⚠️ 這會把所有會員的 credits 全部清零
UPDATE members SET credits = 0;

-- ⚠️ 這會刪掉整張表的所有資料
DELETE FROM members;
```

:::warning
沒有 `WHERE` 的 `UPDATE`／`DELETE` 會對**整張表**生效，而且沒有「復原」按鈕可以救。在社群上能查到大量真實案例：有工程師在正式環境跑漏了 `WHERE` 的 `UPDATE`，一次把上萬筆薪資資料全部清空。也有人因為忘了 `WHERE` 把整張表 `DELETE` 光，只能靠備份或 binlog 事後救援。也因此 MySQL 提供了 `sql_safe_updates` 安全模式，只要偵測到 `UPDATE`／`DELETE` 沒帶 `WHERE` 就直接擋下報錯。PostgreSQL 沒有同名的內建開關，但原則一樣適用：**下指令前，先用相同的 `WHERE` 條件跑一次 `SELECT` 確認影響範圍，再執行 `UPDATE` 或 `DELETE`**。
:::

### 九、SQL 語法快速複習卡

| 操作 | 語法 |
| --- | --- |
| 查詢所有欄位 | `SELECT * FROM 表;` |
| 查詢指定欄位 | `SELECT 欄位 FROM 表;` |
| 篩選條件 | `WHERE 條件` |
| 排序 | `ORDER BY 欄位 ASC\|DESC` |
| 限制筆數 | `LIMIT N` |
| 新增 | `INSERT INTO 表 (欄位...) VALUES (值...);` |
| 修改 | `UPDATE 表 SET 欄位 = 值 WHERE 條件;` |
| 刪除 | `DELETE FROM 表 WHERE 條件;` |

- **子句順序**：`SELECT → FROM → WHERE → ORDER BY → LIMIT`



### 十、資料來源

**課程原始講義**

- [Week 5：PostgreSQL 資料庫基礎概念 1](https://hackmd.io/WRhE5_4gTIa5dWgP_rJKIw)
- [Day 17 - 認識資料表與 SELECT 選取](https://hackmd.io/drGf8mZOSKGJUtop-izATw)
- [Day 18 - WHERE 篩選條件](https://hackmd.io/@hex-course/HyXJRSZfGl)
- [Day 19 - ORDER BY 排序與 LIMIT](https://hackmd.io/@hex-course/B1FT-FffMg)
- [Day 20 - INSERT / UPDATE / DELETE 資料寫入](https://hackmd.io/@hex-course/B1CNvYGGzg)
- [Day 21 - 書店後台 SQL 綜合演練](https://hackmd.io/@hex-course/SJ9Batffzl)
- [PostgreSQL 官方文件 — Querying a Table（SELECT * 使用建議）](https://www.postgresql.org/docs/current/tutorial-select.html)
- [PostgreSQL 官方文件 — SELECT 完整語法](https://www.postgresql.org/docs/current/sql-select.html)
- [PostgreSQL 官方文件 — Numeric Types（INTEGER / NUMERIC 選用建議）](https://www.postgresql.org/docs/current/datatype-numeric.html)
- [MySQL 安全更新模式 sql_safe_updates 說明](https://www.cnblogs.com/gomysql/p/3582058.html)
- [真實案例：UPDATE 漏寫 WHERE 導致上萬筆資料被清空](https://thecodeforge.io/database/sql-insert-update-delete/)