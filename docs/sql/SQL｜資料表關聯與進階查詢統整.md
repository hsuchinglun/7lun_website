---
title: SQL｜資料表關聯與進階查詢統整
sidebar_position: 3
tags: [PostgreSQL, SQL, 資料庫, 知識點筆記]
date: 2026-07-20
slug: sql-table-relations
---

### 一、為什麼要拆成多張資料表

#### 1. 單一資料表的問題

- 真實系統（部門、員工、專案、參與紀錄）的資料庫由多張表組成。如果把所有資料塞在同一張表，同一筆資料會重複出現在多列：

  | employee_name | team_name | team_location | project_name |
  | --- | --- | --- | --- |
  | 張小明 | 開發部 | 台北 | 官網改版 |
  | 張小明 | 開發部 | 台北 | 招募系統 |
  | 王大明 | 開發部 | 台北 | 官網改版 |
  | 李小華 | 人事部 | 高雄 | 招募系統 |
  | 林小豪 | 開發部 | 台北 | 招募系統 |

- 開發部的「台北」重複出現四次。部門換辦公室時要同時修改多筆，漏改一筆資料就不一致。

#### 2. 拆成多張表

- 每筆資料只存一次，再用 `id` 互相連接：

  ```sql
  users.team_id → teams.id
  ```

- 開發部的資料只存在 `teams` 表一次，所有員工透過 `team_id` 指向它，改一筆就全部生效。

#### 3. 從欄位角度分析

- 拿到一張大表時，逐欄問「這個欄位是描述誰的？」：
  - 訂單表裡的客戶姓名、電話、地址是「客戶」的屬性，同一位客戶下多筆訂單就會重複，應拆出客戶表。
  - 掛號表裡的姓名、身分證字號、生日是「病患」的屬性，應拆出病患表。

:::note
**重複出現的一組欄位，就是該獨立成表的訊號。**
:::

### 二、主鍵與外來鍵

#### 1. 定義

- **主鍵（Primary Key，PK）**：每張表裡每筆資料的唯一識別，通常是 `id`，不可重複、不可為 `NULL`。
- **外來鍵（Foreign Key，FK）**：指向另一張表某筆資料 `id` 的欄位，用來建立關聯。
  - 例如 `users.team_id = 2`，代表這位員工的部門是 `teams` 表裡 `id = 2` 的那個。

#### 2. 建表語法

- 用 `SERIAL` 讓主鍵自動遞增、用 `FOREIGN KEY ... REFERENCES` 宣告外來鍵：

  ```sql
  -- 部門資料表（一方）
  CREATE TABLE teams (
      id SERIAL PRIMARY KEY,   -- 部門編號，主鍵；SERIAL 自動遞增
      name VARCHAR(50)         -- 部門名稱
  );

  -- 員工資料表（多方，持有外來鍵）
  CREATE TABLE users (
      id SERIAL PRIMARY KEY,   -- 員工編號，主鍵
      name VARCHAR(50),
      salary INTEGER,
      team_id INTEGER,         -- 部門編號，外來鍵
      FOREIGN KEY (team_id) REFERENCES teams(id)  -- 宣告關聯
  );

  INSERT INTO teams (name) VALUES ('開發部'), ('人事部');

  INSERT INTO users (name, salary, team_id) VALUES
      ('張小明', 45000, 1),
      ('王大明', 48000, 1),
      ('李小華', 52000, 2),
      ('陳小玉', 55000, 2),
      ('林小豪', 47000, 1);
  ```

:::warning
宣告 `FOREIGN KEY` 之後，插入一筆 `team_id = 5` 的員工（但 `teams` 表沒有 id 5）會直接報錯，這是資料庫在保護關聯完整性。反過來說，修改 `teams` 的部門名稱不影響員工表，因為員工存的是 id 不是名稱，這正是拆表的好處。
:::

### 三、資料表關聯類型

#### 1. 規劃流程：兩個方向各問一次

- 從欄位角度、用兩個方向分析：
  - 以「員工」角度：一個員工屬於 **1** 個部門。
  - 以「部門」角度：一個部門有 **多** 個員工。
  - 結論：部門與員工是「一對多」，外來鍵放在多的那一方（`users.team_id`）。

  | 關係 | 範例 | 實作方式 |
  | --- | --- | --- |
  | 一對多 | 一個部門 → 多位員工 | `users.team_id` 外來鍵指向 `teams.id` |
  | 多對多 | 多位員工 ↔ 多個專案 | 中間表 `employee_projects`，同時存 `user_id` 與 `project_id` |

#### 2. 多對多需要中間表

- 一位員工可以參與多個專案，一個專案也可以有多位員工參與。只在 `users` 或 `projects` 其中一張表加外來鍵，都無法完整記錄這種關係。
- 解法是建立中間表（關聯表）`employee_projects`，每一筆只記兩個外來鍵，也就是 `user_id`（誰）與 `project_id`（參與了哪個專案），一筆就代表一個「參與關係」：

  | id | user_id | project_id |
  | --- | --- | --- |
  | 1 | 1 | 1 |
  | 2 | 1 | 3 |
  | 3 | 2 | 2 |

:::info
**辨識關聯類型的口訣：**
- 兩邊各問一次「一個 A 對應幾個 B？」
  - 兩邊都答「一個」→ 一對一
  - 一邊「一個」一邊「多個」→ 一對多，外來鍵放多的那方
  - 兩邊都「多個」→ 多對多，開中間表
:::

### 四、多表查詢與 JOIN

#### 1. 兩步查法：在使用 `JOIN` 之前，可以把跨表查詢拆成兩步：先查外來鍵的值，再拿值去查另一張表

  ```sql
  -- 想知道「開發部（id = 1）有哪些員工」

  -- 步驟一：到 users 表，找出 team_id = 1 的所有員工
  SELECT * FROM users WHERE team_id = 1;

  -- 步驟二：到 teams 表確認 id = 1 是哪個部門
  SELECT * FROM teams WHERE id = 1;
  ```

#### 2. 順著中間表追多對多

  ```sql
  -- 張小明（user_id = 1）參與了哪些專案
  SELECT * FROM employee_projects WHERE user_id = 1;

  -- 官網改版（project_id = 1）有誰參與
  SELECT * FROM employee_projects WHERE project_id = 1;
  ```

:::note
這種查法能運作，但每個問題都要下兩、三條查詢，這就是 `JOIN` 要解決的問題。
:::

#### 3. JOIN 的用途

- `JOIN` 依照指定的外來鍵關係，在一條語句內把多張表合併成一張結果：

  ```sql
  -- 之前要兩步：
  SELECT * FROM users WHERE team_id = 1;
  SELECT * FROM teams WHERE id = 1;

  -- 現在一步搞定：
  SELECT users.name, teams.name
  FROM users
  INNER JOIN teams
      ON users.team_id = teams.id;
  ```

- `ON` 指定兩張表怎麼對應：「哪個欄位相等時才算同一筆關聯資料」。這裡是 `users.team_id = teams.id`。

#### 4. 資料表別名

- 表名太長時用 `AS`（或直接空格）取別名，讓查詢簡潔：

  ```sql
  SELECT u.name AS user_name, t.name AS team_name
  FROM users u                  -- u 是 users 的別名
  INNER JOIN teams t
      ON u.team_id = t.id;
  ```

#### 5. INNER JOIN

- 只保留兩張表**都對得上**的資料列，任一邊找不到對應的列會被捨棄，**實戰 80%～90% 的情境都用它**

  ```sql
  SELECT u.name AS user_name, t.name AS team_name
  FROM users u
  INNER JOIN teams t
      ON u.team_id = t.id;
  ```

  | user_name | team_name |
  | --- | --- |
  | 張小明 | 開發部 |
  | 王大明 | 開發部 |
  | 李小華 | 人事部 |
  | 陳小玉 | 人事部 |

- **多表 INNER JOIN**：每加一張表就再加一行 `INNER JOIN`。查多對多時通常從中間表出發：

  ```sql
  -- 所有專案參與記錄：員工姓名 + 專案名稱
  SELECT u.name AS user_name, p.name AS project_name
  FROM employee_projects ep                     -- 從中間表出發
  INNER JOIN users u ON ep.user_id = u.id       -- 接上員工
  INNER JOIN projects p ON ep.project_id = p.id;-- 接上專案
  ```

#### 6. LEFT JOIN

- 保留**左表**（`FROM` 後面那張）的所有資料列；右表沒對到的欄位補 `NULL`。
- 典型用途：找出「沒有關聯資料」的列，例如還沒參與任何專案的員工：

  ```sql
  SELECT u.name, ep.project_id
  FROM users u                     -- users 是左表，每位員工都會出現
  LEFT JOIN employee_projects ep
      ON u.id = ep.user_id;
  ```

  | name | project_id |
  | --- | --- |
  | 張小明 | 1 |
  | 張小明 | 3 |
  | 王大明 | 2 |
  | 李小華 | 1 |
  | 李小華 | 2 |
  | 李小華 | 4 |
  | 趙大媽 | NULL |

- 趙大媽從未參與專案，`INNER JOIN` 會直接把她丟掉，`LEFT JOIN` 則保留她並在 `project_id` 補 `NULL`，這個 `NULL` 就是「找出未參與專案員工」的線索。

#### 7. RIGHT JOIN 與 FULL JOIN

| 類型 | 說明 |
| --- | --- |
| `RIGHT JOIN` | 保留右表所有資料，左表沒對到補 `NULL`（方向與 LEFT 相反） |
| `FULL JOIN` | 兩邊全保留，沒對到的一律補 `NULL` |

- 為了看出差異，把 `teams` 與 `users` 各補一筆「對不到另一邊」的資料：
  - `teams` 新增「行銷部（id = 3）」，但裡面還沒有員工 → 右表有、左表對不到。
  - `users` 新增「吳總經理（id = 6, team_id = NULL）」，他不屬於任何部門 → 左表有、右表對不到。

    ```sql
    INSERT INTO teams VALUES (3, '行銷部');                     -- 沒有對應員工
    INSERT INTO users VALUES (6, '吳總經理', 100000, NULL);     -- 沒有對應部門
    ```

- **RIGHT JOIN**：保留右表（`teams`）的每一列，即使左表沒有對應的員工也會出現，`users` 欄位補 `NULL`：

  ```sql
  SELECT u.name AS user_name, t.name AS team_name
  FROM users u
  RIGHT JOIN teams t
      ON u.team_id = t.id;
  ```

  | user_name | team_name |
  | --- | --- |
  | 張小明 | 開發部 |
  | 王大明 | 開發部 |
  | 林小豪 | 開發部 |
  | 李小華 | 人事部 |
  | 陳小玉 | 人事部 |
  | NULL | 行銷部 |

  - 行銷部沒有員工，但因為在右表（`teams`）所以被保留，`user_name` 補 `NULL`；「吳總經理」在左表且對不到部門，被捨棄。
  - `RIGHT JOIN` 其實可以改寫成把左右表對調的 `LEFT JOIN`，結果相同，所以實戰上大多只用 `LEFT JOIN`。

- **FULL JOIN**：左右兩表沒對到的列**全部保留**，各自缺的那邊補 `NULL`：

  ```sql
  SELECT u.name AS user_name, t.name AS team_name
  FROM users u
  FULL JOIN teams t
      ON u.team_id = t.id;
  ```

  | user_name | team_name |
  | --- | --- |
  | 張小明 | 開發部 |
  | 王大明 | 開發部 |
  | 林小豪 | 開發部 |
  | 李小華 | 人事部 |
  | 陳小玉 | 人事部 |
  | 吳總經理 | NULL |
  | NULL | 行銷部 |

  - 「吳總經理」（有員工無部門）與「行銷部」（有部門無員工）兩邊的孤兒列都被保留，這是 `INNER` / `LEFT` / `RIGHT` 都做不到的。
  - 典型用途：對帳。想找出「兩邊資料對不起來」的缺口時（哪些員工沒部門、哪些部門沒員工），`FULL JOIN` 一次抓出兩種。

:::note
`RIGHT JOIN` 與 `FULL JOIN` 實戰較少見，理解概念即可；主力是 `INNER JOIN` 與 `LEFT JOIN`。`RIGHT JOIN` 幾乎都能用對調表的 `LEFT JOIN` 取代，`FULL JOIN` 則在需要同時檢查兩邊未匹配資料時才用得上。
:::

### 五、PostgreSQL 常用函式

#### 1. COALESCE 取代 NULL

- `NULL` 代表「沒有資料」，不是空字串 `''` 也不是 `0`。
- `COALESCE` 依序掃描參數，回傳第一個不是 `NULL` 的值，常用來給替代文字：

  ```sql
  SELECT name, COALESCE(bonus, 0) AS final_bonus
  FROM users;
  -- bonus 是 NULL 的員工會顯示 0，而不是空白
  ```

#### 2. 字串函式

| 函式 | 用途 | 範例 |
| --- | --- | --- |
| `UPPER(str)` | 轉大寫 | `UPPER('alice')` → `'ALICE'` |
| `LENGTH(str)` | 取字元長度 | `LENGTH('hello')` → `5` |
| `SPLIT_PART(str, delimiter, n)` | 依分隔符切字串取第 n 段 | `SPLIT_PART('alice@gmail.com', '@', 2)` → `'gmail.com'` |

  ```sql
  SELECT
      UPPER(name) AS upper_name,
      LENGTH(email) AS email_length,
      SPLIT_PART(email, '@', 2) AS domain   -- 以 @ 切開取第 2 段 = 網域
  FROM users;
  ```

#### 3. 日期與數字處理

- `EXTRACT` 從日期時間欄位取出指定部分：

  ```sql
  SELECT
      id,
      EXTRACT(YEAR FROM joined_at) AS join_year,
      EXTRACT(MONTH FROM joined_at) AS join_month
  FROM users;
  ```

- `ROUND(col, n)` 四捨五入到 n 位小數：

  ```sql
  SELECT id, ROUND(salary, 0) AS rounded_salary FROM users;
  -- 45000.75 → 45001
  ```

- `EXTRACT(EPOCH FROM ...)` 取兩個時間戳的**總秒數差**，除以 60 得分鐘數；`::int` 把結果轉整數：

  ```sql
  SELECT
      id,
      (EXTRACT(EPOCH FROM (left_at - joined_at)) / 86400)::int AS days_employed
  FROM users
  WHERE status = 'resigned';   -- 只有離職的員工才有 left_at
  ```

#### 4. CASE 條件式

- SQL 的 if-else，把欄位值轉成易讀標籤：

  ```sql
  SELECT
      id,
      CASE status
          WHEN 'active'    THEN '在職'
          WHEN 'resigned'  THEN '離職'
          WHEN 'unpaid'    THEN '留職停薪'
          ELSE '未知'                     -- 全部不符合時的保底
      END AS status_label
  FROM users;
  ```

- 依序比對 `WHEN`，符合就輸出對應的 `THEN` 值，都不符合走 `ELSE`。

### 六、GROUP BY 分組與聚合

#### 1. GROUP BY 的概念

- 報表常見的需求是「每個部門有多少人」、「每個專案參與人數」這類**摘要**資料。
- `GROUP BY` 把相同欄位值的列合併成一組，聚合函數對每組各自計算，**每組只回傳一列**：

  ```sql
  -- 沒有 GROUP BY：回傳 7 列（每位員工一列）
  SELECT * FROM users;

  -- 加上 GROUP BY：依 team_id 分組，回傳 3 列（每個部門一列）
  SELECT team_id, COUNT(*) AS user_count
  FROM users
  GROUP BY team_id;
  ```

#### 2. 搭配聚合函數

  ```sql
  SELECT
      team_id,
      COUNT(*) AS user_count,
      SUM(salary) AS total_salary,
      AVG(salary) AS avg_salary
  FROM users
  GROUP BY team_id;
  ```

:::note
`AVG` 預設可能有較多小數位，實務上建議搭配 `ROUND(AVG(col), 2)` 控制精度。
:::

#### 3. WHERE 與 HAVING 的差異

- 圖片解釋：WHERE 在分組前篩「資料列」，HAVING 在分組後篩「群組」

  ![WHERE 與 HAVING](/img/sql03-2.png)

- `WHERE` 在分組**前**篩「資料列」，`HAVING` 在分組**後**篩「群組」，執行順序：

  ```sql
  WHERE → GROUP BY → HAVING → SELECT
  ```

  ```sql
  -- WHERE：先排除非 active 的列，剩下的才分組加總（篩的是「列」）
  SELECT team_id, SUM(salary) AS active_total_salary
  FROM users
  WHERE status = 'active'
  GROUP BY team_id;

  -- HAVING：先分組統計，再丟掉人數不足的群組（篩的是「組」）
  SELECT team_id, COUNT(*) AS user_count
  FROM users
  GROUP BY team_id
  HAVING COUNT(*) >= 2;   -- 某部門只有 1 人，整組被篩掉
  ```

:::warning
聚合條件不能寫在 `WHERE`。`WHERE COUNT(*) >= 2` 會報錯，因為 `WHERE` 執行時還沒分組，根本沒有 `COUNT(*)` 可以比。凡是條件裡出現聚合函數（`COUNT`、`SUM`、`AVG`…），一律寫在 `HAVING`。
:::

### 七、子查詢

#### 1. 什麼是子查詢

- 有些查詢條件本身需要**另一段 SELECT 的結果**才算得出來，例如「找出薪水等於最高薪水的員工」，最高薪水要先查過才知道。
- 子查詢（Subquery）：括號內的 SELECT 先跑完，把結果交給外層使用：

  ```sql
  SELECT id, salary
  FROM users
  WHERE salary = (SELECT MAX(salary) FROM users);
  -- 內層先算出 100000，外層再用這個值篩選
  ```

#### 2. 放在 WHERE

- 最常見的用法，搭配 `IN`、`NOT IN` 或 `=`：

  ```sql
  -- IN：找出有參與過專案的員工
  SELECT name FROM users
  WHERE id IN (SELECT DISTINCT user_id FROM employee_projects);

  -- NOT IN：找出從未參與過專案的員工
  SELECT name FROM users
  WHERE id NOT IN (SELECT DISTINCT user_id FROM employee_projects);
  ```

:::warning
`= (SELECT ...)` 的子查詢必須只回傳「一個值」，若回傳多列會報錯；多值情境改用 `IN`。
:::

#### 3. 放在 SELECT

- 在欄位清單裡加子查詢，對每一列額外算出一個欄位：

  ```sql
  -- 每位員工薪水，並附上全體平均薪水
  SELECT
      id,
      salary,
      (SELECT ROUND(AVG(salary), 0) FROM users) AS overall_avg
  FROM users;
  -- 每列的 overall_avg 都是同一個值（整體平均）
  ```

- 子查詢對每一列各執行一次，所以只適合回傳單一值的場合。

#### 4. 放在 FROM：衍生表（Derived Table）

- 圖片解釋：衍生表是把「查詢結果當成一張新表」，再對它進行進一步的查詢或篩選。

  ![衍生表](/img/sql03-1.png)

- 前面兩種子查詢回傳的是「一個值」或「一組值」。放在 `FROM` 的子查詢不一樣：它回傳的是**一整張表**（多列多欄），可以被外層當成一般資料表來 `JOIN`、篩選、再聚合。
- 依 PostgreSQL 官方文件，`FROM` 子句的資料來源不一定是實體資料表，也可以是子查詢、`JOIN` 結果，或這些的複雜組合；這種由子查詢臨時產生、供外層使用的表就叫**衍生表（derived table）**。

- **為什麼需要它**：`GROUP BY` 只能分組聚合一次，但有些需求要「先聚合、再對聚合結果做進一步處理」。
- 例如「找出平均薪水超過 50000 的部門名稱」，得**先算出各部門平均（第一步聚合），再拿平均值去篩選並接上部門名稱（第二步）**。
- 單一層 SQL 做不到，就把第一步包成衍生表：

  ```sql
  SELECT d.name, t.avg_salary
  FROM teams d
  JOIN (
      SELECT team_id, ROUND(AVG(salary), 0) AS avg_salary
      FROM users
      GROUP BY team_id
  ) t ON d.id = t.team_id       -- t 是衍生表，可以像真的資料表一樣被 JOIN
  WHERE t.avg_salary > 50000;
  ```

  - 內層（衍生表 `t`）先算出每個部門的平均薪水：

    | team_id | avg_salary |
    | --- | --- |
    | 1 | 46500 |
    | 2 | 53500 |
    | 3 | 48000 |
    | 4 | 61000 |

  - 外層再把 `t` 當一般資料表，`JOIN teams` 補上名稱、用 `WHERE t.avg_salary > 50000` 篩掉平均不足的部門：

    | name | avg_salary |
    | --- | --- |
    | 人事部 | 53500 |
    | 財務部 | 61000 |

  - 開發部（46500）與行銷部（48000）未超過 50000 被篩掉；法務部如果沒有員工，衍生表裡沒有它，`JOIN` 後也不會出現。

- **對聚合結果再聚合**：衍生表也能包一層聚合，讓外層再算一次。例如「各部門的平均薪水，全部平均起來是多少」：

  ```sql
  SELECT ROUND(AVG(avg_salary), 0) AS avg_of_avg
  FROM (
      SELECT team_id, AVG(salary) AS avg_salary
      FROM users
      GROUP BY team_id
  ) t;                          -- 外層對衍生表的 avg_salary 再取一次平均
  ```

- 這種「聚合的聚合」沒辦法只靠一層 `GROUP BY` 完成，必須先用衍生表把第一層結果固定下來。

:::warning
放在 `FROM` 的衍生表**必須加別名**（上例的 `t`），否則報錯。這是 PostgreSQL 的規定：官方文件說明，依 SQL 標準子查詢必須提供表別名；PostgreSQL 16 起才放寬為可省略，但仍建議一律加上，以維持相容性與可讀性。
:::



### 八、資料來源

- [Week 6：PostgreSQL 資料庫基礎概念 2](https://hackmd.io/@hexschool/r1HCjk8Nfe)
- [Day 22 - 資料表關聯：主鍵、外鍵與順著外鍵查詢](https://hackmd.io/0CcO2FaJQQW0iHTjl8KWKg?view)
- [Day 23 - JOIN 將拆分的資料表關聯起來](https://hackmd.io/@hex-course/HyF_ytIzfg)
- [Day 24 - 使用 PostgreSQL 函式將資料加工](https://hackmd.io/@hex-course/SyCGCYLMzg)
- [Day 25 - GROUP BY 分組與聚合](https://hackmd.io/@hex-course/B1qc97dGfl)
- [Day 26 - 子查詢：把一段 SELECT 放進另一段 SQL](https://hackmd.io/@hex-course/SyV-lEdfGg)
- [PostgreSQL 官方文件：7.2. Table Expressions（衍生表定義與別名規定）](https://www.postgresql.org/docs/current/queries-table-expressions.html)