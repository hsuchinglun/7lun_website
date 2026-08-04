---
title: NodeJS｜TypeORM 資料表結構管理統整
sidebar_position: 9
tags:
  - TypeORM
  - ORM
  - PostgreSQL
  - Node.js
  - Express
  - 資料庫
  - 知識點筆記
date: 2026-08-03
slug: typeorm-entity-migration-seeder
---

- 之前的主題大多站在「資料庫已經建好」的角度操作：怎麼查、怎麼加索引調效能。這次把焦點往前挪一步，處理的是查詢之前的事：**資料表本身是怎麼被設計、被建立、被修改的，以及這些動作如何留下紀錄**。

- 核心的心智模型是一條動線：

  ![TypeORM 資料表結構管理統整](/img/nodejs08-1.png)


- **前三步資料庫都是靜止的，只有 `migration:run` 會動結構，只有 `seed` 會動資料**。


### 一、資料表結構為什麼需要被管理

#### 1. 手動建表的問題不在功能，在紀錄

- 直接在資料庫裡打 `CREATE TABLE`、`ALTER TABLE`，功能上完全沒問題，表確實會建出來。少掉的是**紀錄**。
- 少了紀錄會冒出三個實際的麻煩：
  - 自己過一陣子回頭看，忘記當初為什麼這樣設計、改過哪些欄位
  - 換人接手時，新人得自己去資料庫東翻西找，才能拼湊出資料表怎麼演變成現在這樣
  - 每個人手動操作的習慣不同，同一份「應該長得一樣」的資料表，在不同機器、不同環境上結構卻兜不起來

:::note
判斷有沒有問題的標準不是「表建得出來嗎」，而是「另一個人能不能在另一台機器上重建出一模一樣的結構」。
:::

#### 2. Migration 是把結構變更寫成可保留的紀錄

- **Migration（遷移）** 就是把「建立或修改資料表結構」這件事寫成檔案，而不是憑手動操作、事後沒有痕跡。
- 一份 migration 通常記錄三件事：什麼時候（時間戳記）、動了哪張表、做了什麼修改。

  ```sql
  -- 1785686400_create_classes_table.sql
  -- 檔名帶時間戳記，代表「什麼時候做了什麼修改」

  CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
  );
  ```

  ```sql
  -- 1785772800_add_teacher_to_classes.sql
  -- 之後要加欄位，就再寫一份新的 migration，不是回去改前一份

  ALTER TABLE classes ADD COLUMN teacher VARCHAR(50);
  ```

- 有了這串紀錄，不管換到哪台機器、哪個環境，照順序重跑一次就能得到一模一樣的結構。

#### 3. 結構能重建，才有辦法安全重置

- 因為整份結構都被記在 migration 裡，開發階段的資料庫可以安全地清空重來：把資料庫倒掉，再把所有 migration 依序跑一次，就回到乾淨且正確的結構。
- 沒有這套做法時，重置就得靠人工回想或翻找過去的操作紀錄，一張一張手動建回來，很容易漏掉某個欄位或某次調整，導致重置後的結構跟原本對不上。

### 二、用 Entity 描述一張資料表

#### 1. 先把 TypeORM 裝起來，並設定 migration 指令
 
- 寫 entity 之前要先有工具。安裝兩個套件：
  ```bash
  npm install typeorm pg
  ```
 
  | 套件 | 角色 |
  | --- | --- |
  | `typeorm` | ORM 本體，負責把 entity 翻譯成 SQL、產生與執行 migration |
  | `pg` | PostgreSQL 的驅動，真正跟資料庫講話的是它 |
- 這兩個要一起裝。TypeORM 只負責翻譯，沒有 `pg` 它連不上 PostgreSQL，連線時會直接報錯說找不到 driver。連線資訊放 `.env`，所以再加一個 `dotenv`。
- 接著在 `package.json` 的 `scripts` 加上 migration 指令：
  ```json
  {
    "scripts": {
      "migration:generate": "typeorm migration:generate -d ./db/data-source.js -o",
      "migration:run": "typeorm migration:run -d ./db/data-source.js",
      "migration:revert": "typeorm migration:revert -d ./db/data-source.js"
    }
  }
  ```
 
  | 參數 | 意思 |
  | --- | --- |
  | `-d ./db/data-source.js` | 指定 data source 檔案，告訴 TypeORM 去哪裡讀連線設定和 entity 清單 |
  | `-o` | 產出 `.js` 格式的 migration 檔。預設是 `.ts`，這個專案沒用 TypeScript |

- 實際使用時後面還要接檔名：中間那個 `--` 是給 npm 看的，意思是「後面的東西不是給你的，原封不動轉交給底層指令」。少了它，`db/migrations/Init` 會被 npm 自己吃掉，傳不到 `typeorm` 手上。
  
  ```bash
  npm run migration:generate -- db/migrations/Init
  ```

#### 2. Entity 是資料表的設計圖

- Entity 是用程式碼描述「**一張資料表長什麼樣子**」：有哪些欄位、什麼型別、能不能空白、會不會重複、哪個是主鍵。寫好之後交給工具，由它去建立或比對實際的資料表結構。

  ```javascript
  // entities/CreditPackage.js
  const { EntitySchema } = require('typeorm')

  module.exports = new EntitySchema({
    name: 'CreditPackage',        // 程式裡的識別字：getRepository('CreditPackage') 用它
    tableName: 'CREDIT_PACKAGE',  // 資料庫裡實際的表名
    columns: {
      id: {
        primary: true,
        type: 'uuid',
        generated: 'uuid',        // 自動產生 uuid
        nullable: false,
      },
      name: {
        type: 'varchar',
        length: 50,
        nullable: false,
        unique: true,
      },
      credit_amount: {
        type: 'integer',
        nullable: false,
      },
      price: {
        type: 'numeric',          // 注意：numeric 從資料庫回來會是字串
        precision: 10,
        scale: 2,
        nullable: false,
      },
      created_at: {
        type: 'timestamp',
        createDate: true,         // 新增資料時自動填入當下時間
        nullable: false,
      },
    },
  })
  ```

#### 2. 欄位設定一覽

| 設定 | 作用 |
| --- | --- |
| `primary` | 是否為主鍵，用來唯一識別一筆資料 |
| `type` | 欄位型態，如 `varchar`、`integer`、`numeric`、`text`、`timestamp`、`uuid` |
| `length` | 字串長度上限 |
| `precision` / `scale` | 數字的總位數與小數位數 |
| `nullable` | 能否留空，`false` 代表必填 |
| `unique` | 值不可與其他資料重複 |
| `generated` | 自動生成方式，如 `'uuid'` 或自動遞增 |
| `createDate` | 新增資料時自動填入當下時間 |
| `updateDate` | 每次更新該筆資料時自動改成當下時間 |

- `name` 和 `tableName` 是兩件事：`name` 是程式層級的 Entity 識別字，`getRepository` 時使用；`tableName` 是資料庫實際表名，可以自行指定。
- 「必填」和「唯一」是兩個各自獨立的限制，缺一不可。`nullable: false` 只保證欄位一定有值，不保證這個值不會跟別筆重複；課程代碼、email 這種不可重複的需求，必須另外加上 `unique: true`。
- 建立時間、更新時間這類欄位不需要每次寫入時自己塞值，交給 `createDate` / `updateDate` 在寫入或更新的當下自動補上。

#### 3. 對照手寫的 CREATE TABLE

| 手寫 SQL | EntitySchema 寫法 |
| --- | --- |
| `CREATE TABLE "CREDIT_PACKAGE"` | `tableName: 'CREDIT_PACKAGE'` |
| `id UUID PRIMARY KEY` 自動生成 | `primary: true, type: 'uuid', generated: 'uuid'` |
| `name VARCHAR(50) NOT NULL UNIQUE` | `type: 'varchar', length: 50, nullable: false, unique: true` |
| `price NUMERIC(10,2) NOT NULL` | `type: 'numeric', precision: 10, scale: 2, nullable: false` |
| `created_at TIMESTAMP DEFAULT now()` | `type: 'timestamp', createDate: true` |

:::warning
型別選錯的問題當下看不出來，要等到真的拿資料運算或比對時才會爆。例如把「人數上限」或「金額」存成 `varchar`，畫面顯示正常，但排序時字串比較會把 `"9"` 排在 `"10"` 後面，篩選「大於 20」或加總也算不出正確結果，這時才發現當初型別挑錯了。
:::

#### 4. 寫好 entity 還要註冊

- Entity 檔案寫完之後，要在 `db/data-source.js` 的 `entities` 陣列註冊，工具才看得到它。

  ```javascript
  const CreditPackage = require('../entities/CreditPackage')

  // ...
  entities: [CreditPackage],
  ```

:::warning
`migration:generate` 回報 No changes 時，八成是 entity 寫好了但忘記註冊。
:::

### 三、設計資料表之間的關聯

#### 1. 為什麼要拆表

- 假設健身房的課表要記錄課程名稱、教練、技能類型、時間、名額，最直覺的做法是全部塞進一張 `COURSE` 表：

  | name | coach_name | coach_email | skill_name | start_at |
  | --- | --- | --- | --- | --- |
  | 拳擊有氧 | 阿明教練 | coach.ming@livefit.tw | 拳擊 | 08-03 19:00 |
  | 水中體適能 | 阿明教練 | coach.ming@livefit.tw | 游泳 | 08-08 10:00 |
  | 自由式入門 | 小花教練 | coach.hua@livefit.tw | 游泳 | 08-05 07:00 |

- 這張表有三個問題：
  - 阿明教練的 email 被抄了兩次，他換 email 時要改很多筆
  - 有人打成 `coach.mng@...`，資料庫裡就變成兩個不同的教練
  - 「拳擊」這個技能，沒有課的時候就不存在了
- 正確做法是拆成教練（`USER`）、技能（`SKILL`）、課程（`COURSE`）三張表，課程不存教練的名字，只存一個指過去的號碼（外鍵）。

#### 2. 一對多：外鍵放在「多」的那一邊

- 以文章和留言為例，一篇文章底下有很多則留言，每則留言只屬於一篇文章。**外鍵要放在「多」的那邊，也就是留言表，讓每則留言記住自己屬於哪篇文章**。

  ```sql
  CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
  );

  CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
  );
  ```

- 外鍵對應關係：

  ```text
  articles.id ← comments.article_id   這則留言是哪篇文章底下的
  ```

- 如果把外鍵放反（放到 `articles`），一篇文章有多則留言時，一個欄位沒辦法同時記住好幾個 `comment_id`，結構就表達不出這層關係。

#### 3. 在 entity 裡寫 relations

- 關聯一樣寫進 entity，寫在「多」的那一邊。不用自己宣告 `article_id` 欄位，`joinColumn` 會長出來。

  ```javascript
  // entities/Comment.js
  const { EntitySchema } = require('typeorm')

  module.exports = new EntitySchema({
    name: 'Comment',
    tableName: 'comments',
    columns: {
      id: { type: 'int', primary: true, generated: true },
      content: { type: 'text', nullable: false },
    },
    relations: {
      article: {
        type: 'many-to-one',                  // 多則留言對到一篇文章
        target: 'Article',                    // 指向哪個 entity（用它的 name）
        joinColumn: { name: 'article_id' },   // 資料庫實際的外鍵欄位名
      },
    },
  })
  ```

- 工具會照這份描述在 `comments` 建立指向 `articles` 的外鍵，效果等同手寫的 `REFERENCES articles(id)`。

#### 4. many-to-one 還是 one-to-many

- 「一對多」和「多對一」是同一條關聯的兩種視角，取決於你站在哪張表寫：

  | 站在誰 | 怎麼描述 | 寫法 |
  | --- | --- | --- |
  | `COURSE` | 多堂課 → 一位教練 | `many-to-one` |
  | `USER` | 一位教練 → 多堂課 | `one-to-many` |

- 判斷只有一條規則：**外鍵欄位長在哪張表，那張表就寫 `many-to-one`**。`user_id` 在 `COURSE` 上，所以在 `Course.js` 寫 `many-to-one`。

  ```javascript
  // entities/Course.js（節錄 relations）
  relations: {
    user: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'user_id' },
    },
    skill: {
      target: 'Skill',
      type: 'many-to-one',
      joinColumn: { name: 'skill_id' },
    },
  },
  ```

#### 5. 多對多：另開一張中間表

- 一篇文章可以有多個標籤，一個標籤也會用在很多篇文章上。這種關係沒辦法只靠一個外鍵表達，**不管把外鍵放哪一邊，都只能表達其中一個方向**。
- 解法是另外開一張中間表，讓它的每一筆資料各自對應到兩邊的一筆。換個角度看，中間表就是同時放了兩個外鍵，把一個多對多拆成它對兩邊各自的一對多。

  ```sql
  CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE article_tags (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id),
    tag_id INTEGER REFERENCES tags(id)
  );
  ```

- 外鍵對應關係：

  ```text
  articles.id ← article_tags.article_id   這筆對應是哪篇文章
      tags.id ← article_tags.tag_id       這筆對應是哪個標籤
  ```

- 常見情境的判斷結果：

  | 情境 | 關聯 | 結構 |
  | --- | --- | --- |
  | 一位教練開很多堂課，一堂課一位教練 | 一對多 | `courses.coach_id` → `coaches.id` |
  | 一位學員報很多堂課，一堂課很多學員 | 多對多 | 中間表 `enrollments`，含 `user_id`、`course_id` |
  | 一篇文章多則留言 | 一對多 | `comments.article_id` → `articles.id` |
  | 一篇文章多個標籤，一個標籤多篇文章 | 多對多 | 中間表 `article_tags` |

- 圖解

   ![TypeORM 多對多](/img/nodejs08-2.png)

### 四、synchronize 與 migration 的取捨

#### 1. synchronize 是 ORM 的自動同步開關

- ORM 通常提供一個自動同步結構的選項：

  ```javascript
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,

    synchronize: true,  // 每次程式啟動時，自動把資料庫結構調整成和 entity 一致

    entities: [
      classes,
      subject,
      student,
      grade,
    ],
    migrations: ["db/migrations/*.js"],
  })

  module.exports = { dataSource };
  ```

- 設為 `true` 時，每次程式啟動 ORM 都會自動把資料庫結構對齊 entity。開發初期很方便：改完 entity 存檔，資料表就跟著動，不用手動處理。
- 風險在於這個調整是自動發生的：過程不經人為確認、不留紀錄，而且一旦資料庫已經有資料，它為了對齊 entity 有可能把欄位連同裡面的資料一起刪掉。典型的例子是把 entity 的某個欄位改名，ORM 看到的是「舊欄位不見了、多了一個新欄位」，於是刪掉舊欄位和裡面所有資料，再建一個空的新欄位。

#### 2. 兩者的差別

| | `synchronize: true` | migration |
| --- | --- | --- |
| 誰決定要改什麼 | ORM 自動比對後決定 | 由你明確寫下 |
| 有沒有經過確認 | 不經確認，啟動就執行 | 執行前可以打開檢查 |
| 有沒有留下紀錄 | 沒有 | 每次變更留一個檔案 |
| 資料安全 | 可能連同資料刪掉欄位 | 指令看過才跑 |
| 適用環境 | 全新專案、資料庫還空的開發初期 | 已有資料的環境、正式環境 |

:::warning
鐵律：`synchronize` 固定為 `false`，結構一律走 migration。`synchronize: true` 的風險是弄丟資料，只有在「資料庫還是空的、資料刪掉也無所謂」的環境下這個風險才不成立。
:::


### 五、Migration 的實際流程

#### 1. 心智模型：migration 像 git commit

- 一筆一筆往前加，不回頭改歷史。它幫你守住三件事：
  - 改表之前先看得到要跑的 SQL，不滿意可以改，改完才執行
  - 每次改動留一個檔案，`migrations` 表記帳，團隊誰跑到哪一步一目了然
  - 正式環境不會有人「不小心」把欄位改掉

#### 2. Entity 只是藍圖，migration 才是施工

- 只寫 entity 不跑 migration 就去 seed，會直接爆炸：

  ```text
  seed 失敗： relation "CREDIT_PACKAGE" does not exist
  ```

- 程式連得上資料庫（`initialize` 成功），但資料庫裡根本沒有這張表。Entity 只是描述，它自己不會去蓋表。

#### 3. 兩個步驟：產生，然後檢查後套用

- **第一步：產生**。比對「entity 描述的結構」與「資料庫現在的結構」，把差異寫成 SQL 檔。

  ```bash
  npm run migration:generate -- db/migrations/Init
  ```

  | 指令片段 | 意思 |
  | --- | --- |
  | `migration:generate` | 比對 entity 與資料庫現況，把差異寫成 SQL 檔 |
  | `-- db/migrations/Init` | 檔案放哪、取什麼名字（會自動加時間戳） |

- 產生出來的檔案有 `up` 和 `down` 兩個方法：

  ```javascript
  module.exports = class CreateCourses1750000000000 {
    async up (queryRunner) {
      // 套用這次變動時執行的指令
      await queryRunner.query(`
        CREATE TABLE "courses" (
          "id" SERIAL PRIMARY KEY,
          "title" TEXT NOT NULL,
          "price" INTEGER NOT NULL
        )
      `)
    }

    async down (queryRunner) {
      // 需要退回這次變動時執行的指令
      await queryRunner.query(`DROP TABLE "courses"`)
    }
  }
  ```

- **第二步：檢查後套用**。打開檔案確認 SQL 是不是你要的，確認無誤才執行。

  ```bash
  npm run migration:run
  ```

- 執行後資料庫會多出兩張表：

  | 表 | 誰建的 | 用途 |
  | --- | --- | --- |
  | 你的業務資料表 | 你的 migration | 放實際資料 |
  | `migrations` | TypeORM 自動建立 | 歷史帳本，記錄哪些 migration 跑過，不會重跑 |

:::warning
中間那道「檢查」不能省。工具只看得懂差異、看不懂意圖：你把欄位 `name` 改名成 `title`，它會給你「刪掉 name、新增 title」，資料就沒了，正解是 `RENAME COLUMN`。套用前先看過，才能在指令真的動到資料庫之前擋下有問題的變動。
:::

#### 4. 結構不是建好就固定不變

- 需求變更要加欄位時，做法是保留舊的 migration 不動，另外補一筆新的。舊紀錄是歷史，改掉它並不會改變已經套用過的資料庫，反而會讓紀錄跟現實對不上。
- 往「已經有資料」的表加欄位時，新欄位要允許為空或給預設值，否則舊資料填不上值，migration 會失敗：

  ```sql
  -- courses 表已經有 500 筆資料

  -- ❌ 會失敗：舊有的 500 筆資料，description 要填什麼？
  ALTER TABLE courses ADD COLUMN description TEXT NOT NULL;

  -- ⭕ 允許為空：舊資料的 description 先是 NULL，之後再補
  ALTER TABLE courses ADD COLUMN description TEXT;

  -- ⭕ 或給預設值：舊資料統一先填上預設值
  ALTER TABLE courses ADD COLUMN description TEXT NOT NULL DEFAULT '';
  ```

- 對應到 entity 的寫法就是把新欄位設成 `nullable: true`：

  ```javascript
  meeting_url: {
    type: 'varchar',
    length: 2048,
    nullable: true,  // 表裡已經有課了，加 NOT NULL 欄位會失敗
  },
  ```

- 生第三筆 migration 之後打開檢查，這次不是 CREATE 而是：

  ```sql
  ALTER TABLE "COURSE" ADD "meeting_url" character varying(2048)
  ```

### 六、Seeder：可重複執行的測試資料

#### 1. 先清空，再重新寫入

- Seeder 的目的有兩個：讓開發時有資料可以查，同時確認這個結構真的能用（資料寫得進去）。
- 設計原則是可以重複執行：先清空、再寫入。無論跑幾次，資料都不會重複累積，每次跑完都是同一套乾淨的初始資料。
- 只寫入不清空的話，每執行一次就多塞一輪，跑幾次就累積幾份重複內容，也沒辦法保證每次執行後的狀態一致。
- 前提是資料表要先存在，所以順序一定是先 migration 建結構，再 seed 寫資料。

#### 2. 順序受外鍵限制

- 外鍵必須對應到一筆真實存在的資料。如果文章還不存在就先寫留言，留言的 `article_id` 會指向不存在的資料，資料庫直接報錯拒絕寫入。
- **寫入順序**：先寫「被指向」的表，再寫「指向它」的表。
- **清除順序**：剛好相反，先清「指向別人」的，再清「被指向」的。先刪文章的話，還留在表裡的留言會指向不存在的資料，資料庫同樣會擋下這個刪除動作。
- 以線上課程平台為例：

  ```text
  coaches.id ← courses.coach_id       這堂課是哪位教練開的
    users.id ← enrollments.user_id    這筆報名是哪位學員
  courses.id ← enrollments.course_id  這筆報名是哪堂課
  ```

  | 動作 | 順序 |
  | --- | --- |
  | 寫入 | `coaches`、`users`（彼此無依賴，可互換）→ `courses` → `enrollments` |
  | 清除 | `enrollments` → `courses` → `coaches`、`users` |

#### 3. 用物件表達「這筆資料屬於誰」

- 寫入有關聯的資料時要記下這筆屬於誰。最直覺的做法是先查出對方的 id 再填進外鍵，但用 ORM 可以直接把整個物件塞進 relation，id 交給工具自己填。

  ```javascript
  const { dataSource } = require('./data-source')

  /** 清空：被外鍵指著的表最後刪（先刪 COURSE，再 USER / SKILL） */
  async function clearAll () {
    for (const name of ['Course', 'User', 'Skill', 'CreditPackage']) {
      if (dataSource.hasMetadata(name)) {
        await dataSource.createQueryBuilder().delete().from(name).execute()
      }
    }
  }

  async function main () {
    await dataSource.initialize()
    await clearAll()

    const skillRepo = dataSource.getRepository('Skill')
    const userRepo = dataSource.getRepository('User')
    const courseRepo = dataSource.getRepository('Course')

    // 1. 先種「被指著」的表：SKILL、USER
    const [boxing, swimming] = await skillRepo.save([
      { name: '拳擊' },
      { name: '游泳' },
    ])

    const [ming, hua] = await userRepo.save([
      { name: '阿明教練', email: 'coach.ming@livefit.tw', role: 'COACH' },
      { name: '小花教練', email: 'coach.hua@livefit.tw', role: 'COACH' },
    ])

    // 2. 再種 COURSE：relation 直接塞整個物件，
    //    TypeORM 自己把 id 填進 user_id / skill_id
    await courseRepo.save([
      {
        name: '拳擊有氧',
        description: '邊出拳邊燃脂',
        start_at: '2026-08-03 19:00:00',
        end_at: '2026-08-03 20:00:00',
        max_participants: 16,
        user: ming,
        skill: boxing,
      },
      {
        name: '自由式入門',
        description: '從換氣開始練',
        start_at: '2026-08-05 07:00:00',
        end_at: '2026-08-05 08:00:00',
        max_participants: 8,
        user: hua,
        skill: swimming,
      },
    ])

    console.log('🌱 seed 完成')
    await dataSource.destroy()
  }

  main().catch((e) => {
    console.error('seed 失敗：', e.message)
    process.exit(1)
  })
  ```

- 等於你用「哪一筆資料」來表達關聯，`user_id`、`skill_id` 這些外鍵的值由 ORM 自動找出對應 id 填入，不用自己先查一次。

### 七、專案骨架：從啟動到連上資料庫

- [WEEK8Demo]((https://github.com/gonsakon/node-js-week8-demo-2026))

#### 1. 各個檔案負責什麼

| 檔案／資料夾 | 負責什麼 | 動到什麼 |
| --- | --- | --- |
| `entities/` | 資料表的設計圖，用 JS 描述這張表長怎樣 | 什麼都不動 |
| `db/data-source.js` | TypeORM 連線設定，註冊 entities 與 migrations 路徑 | 什麼都不動 |
| `db/migrations/` | 照設計圖動工的施工單（`CREATE TABLE` / `ALTER TABLE`） | 改結構 |
| `db/seed.js` | 往蓋好的表裡搬家具 | 改資料 |
| `app.js` | Express 骨架：middleware、路由掛載、404、錯誤處理 | 決定「這個應用會回應什麼」 |
| `bin/www.js` | 啟動點：開 port、接資料庫 | 決定「這個應用怎麼跑起來」 |
| `routes/` | 各條路由的 handler | 實際讀寫資料 |
| `docker-compose.yml` | 一鍵起一顆乾淨的 PostgreSQL | 提供資料庫本身 |

#### 2. db/data-source.js：連線設定與註冊

- `.env` 放連線資訊，`db/data-source.js` 初始化 `DataSource`：

  ```javascript
  require('dotenv').config()
  const { DataSource } = require('typeorm')

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5434),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,

    synchronize: false,                     // 鐵律：結構一律走 migration
    entities: [CreditPackage, User, Skill, Course],
    migrations: ['db/migrations/*.js'],
  })

  module.exports = { dataSource }
  ```

- 這份設定會被兩個地方用到：`bin/www.js` 啟動伺服器時拿它連資料庫，`typeorm` 指令則靠 `-d ./db/data-source.js` 讀它來跑 migration。所以 entity 沒註冊在這裡，兩邊都會看不到。

#### 3. app.js 只負責組裝 Express

  ```javascript
  // app.js
  const express = require('express')
  const cors = require('cors')

  const creditPackageRouter = require('./routes/creditPackage')

  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))

  app.get('/healthcheck', (req, res) => {
    res.status(200)
    res.send('OK')
  })
  app.use('/api/credit-package', creditPackageRouter)

  // 404：所有路由都沒接到才會走到這裡
  app.use((req, res) => {
    res.status(404).json({ status: 'failed', message: '無此路由' })
  })

  // 錯誤處理：路由裡 next(error) 之後會落到這裡
  app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ status: 'error', message: '伺服器錯誤' })
  })

  module.exports = app
  ```

- 重點是 `app.js` 裡**沒有** `app.listen()`。它只把應用組好，最後 `module.exports = app` 交出去，真正開 port 是別人的事。
- 掛載順序有意義：middleware 先、路由中間、404 和錯誤處理最後。404 那個 `app.use` 沒有指定路徑，代表前面所有路由都沒接到才會落下來，寫在前面會把正常請求也吃掉。
- 錯誤處理 middleware 必須是四個參數 `(err, req, res, next)`，Express 靠參數個數辨認它，少一個就會被當成一般 middleware。這也是路由裡 `catch` 之後要 `next(error)` 的原因：把錯誤丟給這一層統一回應，而不是每支 API 自己寫一遍 500。

#### 4. bin/www.js 負責啟動與資料庫連線

  ```javascript
  #!/usr/bin/env node
  require('dotenv').config()

  const http = require('http')
  const app = require('../app')
  const { dataSource } = require('../db/data-source')

  const port = process.env.PORT || 3000
  app.set('port', port)

  const server = http.createServer(app)

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} 已經被占用了，是不是還有另一個伺服器開著？`)
      process.exit(1)
    }
    throw error
  })

  server.listen(port, async () => {
    try {
      await dataSource.initialize()   // 先接上資料庫，接不上就不營業
      console.log('資料庫連線成功')
      console.log(`伺服器運作中. port: ${port}`)
    } catch (error) {
      console.error(`資料庫連線失敗: ${error.message}`)
      process.exit(1)
    }
  })
  ```

- `require('dotenv').config()` 放在最上面，`.env` 要在任何人讀 `process.env` 之前載入。`db/data-source.js` 一被 require 就會去讀連線設定，順序反了會拿到 `undefined`。
- 用 `http.createServer(app)` 而不是 `app.listen()`，是為了能掛 `server.on('error')`。`EADDRINUSE` 是最常撞到的錯誤，代表這個 port 已經有另一個伺服器占著，通常是上一次忘了關掉。
- `dataSource.initialize()` 是連線動作，非同步，所以 `listen` 的 callback 寫成 `async`。連不上就 `process.exit(1)` 直接收攤：這是刻意的，沒有資料庫的情況下每支 API 都會炸，讓它在啟動階段就死掉，比讓它半殘地跑著好排查。

:::info
`initialize()` 寫在 `listen` 的 callback 裡，代表 port 是先開、資料庫後接。極短的那段時間內請求進來會失敗，但因為連不上就立刻 `exit`，實務上不會停在那個狀態。
:::

#### 5. 為什麼要拆成兩個檔案

- 兩個檔案回答的是不同問題：`app.js` 回答「這個應用會回應什麼」，`bin/www.js` 回答「這個應用怎麼跑起來」。
- 拆開之後的好處：
  - `app.js` 匯出的是一個沒有在監聽的純 app，寫測試時可以直接 require 進來打，不用真的占一個 port
  - 之後要換啟動方式（改用 HTTPS、同時開多個 port、包成 serverless），只動 `bin/www.js`，路由和 middleware 完全不用碰
  - 資料庫連線、port 設定、錯誤退出這些「環境」的事集中在一個檔案，不會散在路由裡

#### 6. npm scripts 對照

| 指令 | 做什麼 |
| --- | --- |
| `npm start` | `docker compose up -d --wait`，把 PostgreSQL 叫起來 |
| `npm stop` | 停掉 container，資料還在 |
| `npm run db:reset` | `docker compose down -v` 再重開，連 volume 一起砍，整顆資料庫重來 |
| `npm run migration:generate -- db/migrations/名稱` | 比對 entity 與資料庫現況，生出 migration 檔 |
| `npm run migration:run` | 套用還沒跑過的 migration |
| `npm run migration:revert` | 退回最後一筆 migration，執行它的 `down()` |
| `npm run seed` | 執行 `db/seed.js` 種測試資料 |
| `npm run dev` | `nodemon bin/www.js`，存檔自動重啟 |
| `npm run server` | `node bin/www.js`，不會自動重啟 |

- `migration:generate` 和 `migration:run` 背後都帶著 `-d ./db/data-source.js`，指的就是「拿哪份設定去連資料庫、去哪裡找 entity」。
- `db:reset` 砍掉 volume 是真的把資料全部倒掉，能這樣做的前提正是結構都記在 migration 裡，重跑一次就回得來。

---

### 八、Repository：用 JS 讀寫資料表

#### 1. 取得工具箱

- 結構建好、資料種好之後，讓 API 真的能讀寫它靠的是 Repository：

  ```javascript
  const packageRepo = dataSource.getRepository('CreditPackage')
  ```

- 傳入的是 entity 的 `name`（不是 `tableName`）。取得之後就能使用 `.create()`、`.save()`、`.find()`、`.findOne()`、`.delete()`、`.update()` 等方法。
- 順帶一提，`USER` 是 PostgreSQL 保留字，手寫 SQL 查它要加引號寫成 `"USER"`，透過 repository 操作就沒這個問題，因為表名是由 TypeORM 產生的。

#### 2. 方法對照 SQL

| Repository 方法 | 對應的 SQL 直覺 |
| --- | --- |
| `find` | `SELECT 指定欄位 FROM ...` |
| `relations` | `JOIN` 的感覺 |
| 巢狀 select | JOIN 完只挑要的欄位 |
| `findOne` | `WHERE ... LIMIT 1` |
| `create` + `save` | `INSERT` |
| `delete` | `DELETE FROM ... WHERE ...` |

  ```javascript
  // 新增：create 做物件（同步）、save 寫進資料庫（非同步）
  const newPackage = packageRepo.create({ name: '7 堂組合包方案', credit_amount: 7, price: 1400 })
  await packageRepo.save(newPackage)

  // 查詢：全部／挑欄位／條件
  const all = await packageRepo.find()
  const list = await packageRepo.find({
    select: ['id', 'name'],
    where: { name: '7 堂組合包方案' },
  })

  // 查一筆：找不到回 null
  const one = await packageRepo.findOne({ where: { id: someId } })

  // 刪除：回傳的 affected 告訴你真的刪掉幾筆
  const result = await packageRepo.delete(someId)
  ```

:::warning
`create()` 是同步的，只是做出一個物件，不會碰資料庫；`save()` 才真的寫進去。寫成 `await repo.create(...)` 是常見誤會。
:::

#### 3. 三支 API 的完整寫法

- 先準備三個守門用的小函式：

  ```javascript
  function isUndefined (value) {
    return value === undefined
  }

  function isNotValidSting (value) {
    return typeof value !== 'string' || value.trim().length === 0 || value === ''
  }

  function isNotValidInteger (value) {
    return typeof value !== 'number' || value < 0 || value % 1 !== 0
  }
  ```

  ```javascript
  // routes/creditPackage.js
  const express = require('express')
  const router = express.Router()
  const { dataSource } = require('../db/data-source')

  // GET —— 方案列表
  router.get('/', async (req, res, next) => {
    try {
      const packages = await dataSource.getRepository('CreditPackage').find({
        select: ['id', 'name', 'credit_amount', 'price'],
      })
      res.status(200).json({ status: 'success', data: packages })
    } catch (error) {
      console.error(error)
      next(error)
    }
  })

  // POST —— 新增方案
  router.post('/', async (req, res, next) => {
    try {
      const { name, credit_amount, price } = req.body
      if (isUndefined(name) || isNotValidSting(name) ||
          isUndefined(credit_amount) || isNotValidInteger(credit_amount) ||
          isUndefined(price) || isNotValidInteger(price)) {
        res.status(400).json({ status: 'failed', message: '欄位未填寫正確' })
        return
      }
      const creditPackageRepo = dataSource.getRepository('CreditPackage')
      const existPackage = await creditPackageRepo.find({ where: { name } })  // 查重複
      if (existPackage.length > 0) {
        res.status(409).json({ status: 'failed', message: '資料重複' })
        return
      }
      const newPackage = creditPackageRepo.create({ name, credit_amount, price })
      const result = await creditPackageRepo.save(newPackage)
      res.status(200).json({ status: 'success', data: result })
    } catch (error) {
      console.error(error)
      next(error)
    }
  })

  // DELETE —— 刪除方案
  router.delete('/:creditPackageId', async (req, res, next) => {
    try {
      const { creditPackageId } = req.params
      if (isUndefined(creditPackageId) || isNotValidSting(creditPackageId)) {
        res.status(400).json({ status: 'failed', message: 'ID錯誤' })
        return
      }
      const result = await dataSource.getRepository('CreditPackage').delete(creditPackageId)
      if (result.affected === 0) {  // 沒刪到任何東西＝這個 id 不存在
        res.status(400).json({ status: 'failed', message: 'ID錯誤' })
        return
      }
      res.status(200).json({ status: 'success' })
    } catch (error) {
      console.error(error)
      next(error)
    }
  })

  module.exports = router
  ```


### 九、常見狀況與對應動作

| 情況 | 動作 |
| --- | --- |
| 要改表結構 | 改 entity → `migration:generate` → 打開看 SQL → `migration:run` |
| 要種測試資料 | `npm run seed`（設計成可重跑，跑幾次都安全） |
| 要查／寫資料 | repository：`find` / `findOne` / `create` + `save` / `delete`（＋ `relations`） |
| 資料庫弄壞了 | `npm run db:reset` 整顆重開，migration 再跑一次 |
| `generate` 說 No changes | 八成是 entity 沒在 `data-source.js` 註冊 |
| `relation "XXX" does not exist` | entity 寫好了但沒跑 migration，表還沒被建出來 |
| 加欄位時 migration 失敗 | 表裡已有資料，新欄位要 `nullable: true` 或給 `DEFAULT` |
| seed 報外鍵錯誤 | 寫入或清除順序錯了，被指向的表要先寫、後清 |

### 十、資料來源

- [Day 32 - 資料表結構為何需要管理](https://hackmd.io/fMB6FKWYSU6pM94Rf4fphw?view)
- [Day 33 - 使用 entity 描述一張表的結構](https://hackmd.io/SO6OvYq4Rl2PoH1YXHh8Yw?view)
- [Day 34 - 設計資料表之間的關聯](https://hackmd.io/PZk00lsDRaKg5nIN3XJ2Rw?view)
- [Day 35 - 關於 ORM 的同步，以及使用 migration 來管理結構](https://hackmd.io/V_QKZeITQdW_Peart2NnFA?view)
- [Day 36 - 使用 Seeder 寫入資料，確認資料表可以使用](https://hackmd.io/fWoSprA8SE-fVu6qNVX5kQ?view)
- [Week 8：Express + TypeORM 整合 — Migration 與 Seeding](https://hackmd.io/erL1HUyORb6KGgkUkjuF6w?view)
- [TypeORM 官方文件 - Entity Schema](https://typeorm.io/separating-entity-definition)
- [TypeORM 官方文件 - Migrations](https://typeorm.io/migrations)
- [TypeORM 官方文件 - Relations](https://typeorm.io/relations)