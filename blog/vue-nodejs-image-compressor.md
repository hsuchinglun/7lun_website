---
slug: vue-nodejs-image-compressor
title: Pixly 圖片壓縮工具
authors: [7lun]
tags: [project, Vue, Node.js, Express]
date: 2026-06-17
---

### 前言

這次的目標，是用 Vue 3 搭配 Node.js 開發一個圖片壓縮工具。

**專案的核心功能：上傳圖片、壓縮、下載**。但在實際開發的過程中才發現，需要決策的事情不只是「該如何壓縮圖片」，還包含了前後端是否要分離部署、檔案上傳的資料格式該如何解析，以及壓縮後的結果應該存放在哪裡等細節考量。

這篇文章會**整理 formidable 與 sharp 的使用方式**、**前後端分離部署的設定流程**，以及**開發過程中踩到的幾個坑**。

- **Live Demo**：[**Pixly**](https://image-compress-frontend.vercel.app/)
- **GitHub**：[**前端 Repo**](https://github.com/MalricHsu/image-compress-frontend) / [**後端 Repo**](https://github.com/MalricHsu/image-compress-backend)
- **使用技術**：`Vue 3` / `Composition API` / `Vite` / `axios` / `Node.js` / `Express` / `formidable` / `sharp`
- **專案時程**：2026.06.17
- **網站部署**：前端 Vercel / 後端 Render

{/* truncate */}

### 一、架構決策：前後端分開部署

這次專案採用**前後端分離部署**，主要比較了以下兩種方案：

| 方案 | 優點 | 缺點 |
| --- | --- | --- |
| 前後端分離<br/>（Vercel + Render） | 前端可透過 CDN 加速；Vercel 對 Vite／Vue 專案支援成熟，幾乎不需額外設定；前後端可獨立部署與替換，維護彈性較高 | 需要管理兩個部署平台與兩套環境變數；需額外設定 CORS |
| All-in-one<br/>（全部部署於 Render） | 僅需管理單一平台；若前後端整合為同一服務，可避免跨網域問題 | 免費 Static Site 額度較受限；若由 Express 提供前端靜態檔案，則無法充分利用 CDN 加速優勢 |

綜合開發效率、網站效能與後續維護彈性，最終選擇將**前端部署於 Vercel、後端部署於 Render**。

雖然前後端分離需要額外處理 CORS，但只需在 Express 中加入相關 middleware 即可完成設定，實作成本不高。相較之下，Vercel 對 Vue／Vite 專案的良好支援、CDN 加速效果，以及前後端可獨立調整的彈性，更符合本次專案需求。


:::info
**Render 免費方案的休眠特性**

Render 免費方案在閒置約 15 分鐘後會自動休眠，下一次有請求進來時需要 30 秒到 1 分鐘喚醒。對「給自己和家人朋友用」的小工具來說可以接受，但要先知道有這件事，不然第一次打開網站以為壞了。
:::

### 二、後端：用 formidable 接收上傳的檔案

#### 1. 為什麼需要 formidable

Express 本身不會自動解析檔案上傳。一般的 JSON 資料用內建的 `express.json()` 就能處理，但檔案上傳走的是 `multipart/form-data` 格式，這種格式把檔案的二進位內容跟一般文字欄位混在同一個請求裡，用特殊分隔符號區隔開來，Express 沒有內建工具可以解析。

formidable 的工作就是把這份原始資料翻譯成程式碼能直接使用的物件：

1. 把檔案部分寫到伺服器的暫存資料夾（預設是系統的 `tmpdir`）。
2. 把檔案資訊（檔名、大小、MIME type、暫存路徑）包成物件。
3. 把一般文字欄位整理成另一個物件。

#### 2. 基本的上傳路由

```js
import express from 'express'
import cors from 'cors'
import { formidable } from 'formidable'

const app = express()
const PORT = 3000

app.use(cors())

app.post('/upload', async (req, res) => {
  const form = formidable({maxFieldsSize: 8 * 1024 * 1024})

  try {
    const [fields, files] = await form.parse(req)
    console.log('收到的欄位:', fields)
    console.log('收到的檔案:', files)
    res.json({ message: '檔案收到了' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '上傳失敗' })
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
```

`form.parse(req)` 回傳兩個東西：`fields`（文字欄位）跟 `files`（檔案資訊）。如果在終端機觀察印出的結果，會像這樣：

**收到的欄位 (`fields`)**：
如果前端有傳 `quality`、`width` 或 `format` 等文字設定，會被解析成這樣：
```js
{
  quality: [ '70' ],    // 壓縮品質（注意：值是字串格式）
  width: [ '800' ],     // 目標寬度（注意：值是字串格式）
  format: [ 'webp' ]    // 期望輸出的圖片格式
}
```

**收到的檔案 (`files`)**：
檔案則會被轉成 `PersistentFile` 物件，包含了處理圖片時需要的關鍵資訊（如暫存路徑、原始檔名）：
```js
{
  image: [
    PersistentFile {
      filepath: '/tmp/eok5yll3g9rmpb0u6dx10mqjs',   // 檔案目前所在的暫存路徑
      newFilename: 'eok5yll3g9rmpb0u6dx10mqjs',
      originalFilename: '圖片壓縮.jpeg',              // 原始檔名
      mimetype: 'image/jpeg',
      size: 25475
    }
  ]
}
```

#### 3. 為什麼 `files.image` 是陣列

```js
const uploadedFile = files.image[0]
```

第一次看到 `[0]` 會覺得奇怪：明明只上傳一個檔案，為什麼要取陣列的第一個元素？

因為在 HTML 表單中，同一個欄位（例如 `<input type="file" multiple>`）是允許一次上傳多張檔案的。我們可以看看在終端機印出 `console.log(files)` 時，單張圖片與多張圖片的差異：

**如果上傳單一張圖片**：
```js
{
  image: [
    PersistentFile {
      filepath: '/tmp/eok5yll3g9rmpb0u6dx10mqjs',
      newFilename: 'eok5yll3g9rmpb0u6dx10mqjs',
      originalFilename: '圖片1.jpeg',
      mimetype: 'image/jpeg',
      size: 25475
    }
  ]
}
```

**如果一次上傳兩張圖片**：
```js
{
  image: [
    PersistentFile {
      filepath: '/tmp/eok5yll3g9rmpb0u6dx10mqjs',
      newFilename: 'eok5yll3g9rmpb0u6dx10mqjs',
      originalFilename: '圖片1.jpeg',
      mimetype: 'image/jpeg',
      size: 25475
    },
    PersistentFile {
      filepath: '/tmp/a1b2c3d4e5f6g7h8i9j0k1l2m',
      newFilename: 'a1b2c3d4e5f6g7h8i9j0k1l2m',
      originalFilename: '圖片2.jpeg',
      mimetype: 'image/jpeg',
      size: 38192
    }
  ]
}
```

對於後端的 formidable 來說，為了保持資料格式的一致性，避免「收到一張圖時給物件，收到多張圖時給陣列」，導致後端工程師每次都要寫 `if (Array.isArray(files.image))` 來檢查，它的設計哲學是：**不管收到幾張，一律用陣列包裝起來**。

所以，即使你這次只上傳了一張圖片，formidable 還是會交給你一個「只有一個元素的陣列」，這就是為什麼我們必須用 `[0]` 來取出那唯一的值。

`image` 這個 key 名稱來自前端表單的欄位名，兩邊必須對上。

### 三、後端：用 sharp 做壓縮處理

#### 1. sharp 不等於「壓縮」

sharp 是一個圖片處理工具庫，能做的事情很多：旋轉、裁切、加水印、轉格式、調色。壓縮只是其中一種應用。

真正讓檔案變小的是兩個具體動作：

- **縮小尺寸**（`.resize()`）：減少像素數量。
- **降低編碼品質**（`.jpeg({ quality })` 等）：減少儲存每個像素所需的資料量。

兩者都會讓檔案變小，但影響的層面不同。

#### 2. `.toBuffer()` 而不是 `.toFile()`

sharp 處理完的結果有兩種輸出方式：`.toFile('路徑.jpg')` 寫入硬碟，或 `.toBuffer()` 留在記憶體裡。

這裡選 `.toBuffer()`，理由跟部署平台有關。

Render 免費方案的硬碟是非永久性的（ephemeral），伺服器重啟或休眠醒來後，之前寫在硬碟上的檔案會消失。如果設計成「壓縮完存檔，給使用者一個下載連結，等他之後來抓」，中間只要伺服器重啟，檔案就不見了。

用 `.toBuffer()` 的話，壓縮結果直接留在記憶體，馬上透過 `res.send()` 回傳，整個過程一氣呵成，不需要硬碟介入。像手遞手一樣交出去，而不是先放桌上再撿起來。

#### 3. 讓壓縮參數可以自訂

一開始寬度跟品質是寫死的，後來改成從 `fields` 讀取，讓前端可以傳入設定：

```js
const quality = fields.quality ? parseInt(fields.quality[0]) : 70
const width = fields.width ? parseInt(fields.width[0]) : 800

// 從 mimetype 取出原始格式（"image/png" -> "png"）
const originalFormat = uploadedFile.mimetype.split('/')[1]
const format = fields.format
  ? fields.format[0]
  : originalFormat === 'jpg' ? 'jpeg' : originalFormat
```

有兩個地方值得注意：

- **一層包一層的資料結構**：跟 `files` 一樣，formidable 會把一般文字欄位也預設包裝成陣列。我們可以透過以下的「剝開」過程，看看最終端機實際會呈現什麼樣子：

  ```js
  // 1. 整個 fields 物件
  console.log(fields)
  // 輸出: { quality: [ '70' ], width: [ '800' ], format: [ 'webp' ] }

  // 2. 取出 quality 屬性（結果是一個陣列）
  console.log(fields.quality)
  // 輸出: [ '70' ]

  // 3. 取出陣列的第一個元素（結果是字串）
  console.log(fields.quality[0])
  // 輸出: '70'

  // 4. 用 parseInt() 轉型成 sharp 需要的數字
  console.log(parseInt(fields.quality[0]))
  // 輸出: 70
  ```

  :::tip
  **如果上傳多張圖片，`fields` 會有幾筆資料？**
  這取決於前端的設計。通常壓縮設定（如品質、寬度）是套用在整批圖片上的，前端只會送出一次 `formData.append('quality', '70')`。在這種情況下，**不管你上傳了 1 張還是 10 張圖片，`fields.quality` 都只會是一個長度為 1 的陣列 `['70']`**。
  只有當前端「針對每張圖片各自傳送不同的設定」而呼叫多次同名的 append 時，陣列裡面才會有好幾筆資料（如 `['70', '90']`）。
  :::
- **字串與數字的轉型**：透過 `multipart/form-data` 傳過來的欄位預設都是**字串**。但 sharp 的設定需要數字，如果不做處理直接傳給 sharp 會引發錯誤，這就是為什麼在步驟 4 必須加上 `parseInt()`。
- **防呆機制（處理未填寫的情況）**：為什麼要寫 `fields.quality ? ... : 70`？因為這些欄位在前端通常是非必填的。如果使用者沒有填，`fields.quality` 會是 `undefined`。如果我們不先檢查就直接寫 `fields.quality[0]`，程式會因為「試圖讀取 undefined 的屬性」而崩潰。
- **格式名稱的特例處理**：沒傳 `format` 時，沿用上傳檔案的原始格式。要注意的是，若原始格式是 `jpg`，必須手動把它換成 `jpeg`，因為 sharp 只提供 `.jpeg()` 方法，呼叫 `.jpg()` 會找不到函式而報錯。

#### 4. 動態決定輸出格式

`.resize()` 是不管哪種格式都要做的共同步驟，可以先確定；而 `.jpeg()`、`.png()`、`.webp()` 三者互斥，要依使用者的選擇決定。所以把共同部分抽出來存成變數：

```js
let sharpInstance = sharp(uploadedFile.filepath).resize({ width: width })

if (format === 'jpeg') {
  sharpInstance = sharpInstance.jpeg({ quality: quality })
} else if (format === 'png') {
  sharpInstance = sharpInstance.png({ quality: quality })
} else if (format === 'webp') {
  sharpInstance = sharpInstance.webp({ quality: quality })
}

const compressedBuffer = await sharpInstance.toBuffer()
```

如果不抽出來，每個分支都要重複寫一次 `.resize()`，程式碼會變得冗長。


#### 5. 完整的上傳路由

```js
app.post('/upload', async (req, res) => {
  const form = formidable({
    maxFileSize: 8 * 1024 * 1024   // 限制 8MB
  })

  try {
    const [fields, files] = await form.parse(req)

    // 檢查有沒有真的上傳檔案
    if (!files.image || files.image.length === 0) {
      return res.status(400).json({ error: '請上傳一張圖片' })
    }

    const uploadedFile = files.image[0]

    // 檢查檔案類型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(uploadedFile.mimetype)) {
      fs.unlink(uploadedFile.filepath, () => {})
      return res.status(400).json({ error: '只支援 JPEG、PNG、WebP 格式的圖片' })
    }

    const quality = fields.quality ? parseInt(fields.quality[0]) : 70
    const width = fields.width ? parseInt(fields.width[0]) : 800
    const originalFormat = uploadedFile.mimetype.split('/')[1]
    const format = fields.format
      ? fields.format[0]
      : originalFormat === 'jpg' ? 'jpeg' : originalFormat

    let sharpInstance = sharp(uploadedFile.filepath).resize({ width: width })

    if (format === 'jpeg') {
      sharpInstance = sharpInstance.jpeg({ quality: quality })
    } else if (format === 'png') {
      sharpInstance = sharpInstance.png({ quality: quality })
    } else if (format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: quality })
    }

    const compressedBuffer = await sharpInstance.toBuffer()

    // 處理完畢，刪除暫存檔
    fs.unlink(uploadedFile.filepath, (err) => {
      if (err) console.error('刪除暫存檔失敗:', err)
    })

    res.set({ 'Content-Type': `image/${format}` })
    res.send(compressedBuffer)

  } catch (err) {
    console.error(err)

    // formidable 用 1009 代表「檔案超過大小限制」
    if (err.code === 1009) {
      return res.status(413).json({ error: '檔案太大，請上傳 8MB 以下的圖片' })
    }

    res.status(500).json({ error: '上傳失敗' })
  }
})
```

`fs.unlink()` 的第二個參數是 callback，因為刪除是非同步操作。寫成 `() => {}` 表示忽略結果，寫成 `(err) => { ... }` 則可以記錄失敗原因。暫存檔不刪的話，容器空間會慢慢被吃掉。

:::note
`err.code === 1009` 是 formidable 內部固定的錯誤代碼，代表「檔案超過大小限制」，跟你把 `maxFileSize` 設成幾 MB 沒有關係。改了限制值只要改錯誤訊息文字，這個判斷不用動。
:::

### 四、前端：從選擇檔案到顯示結果

#### 1. File 物件與後端物件的差異

前端選擇檔案時，瀏覽器會建立一個原生的 `File` 物件。如果我們把它印出來看：

```js
const handleFileChange = (event) => {
  const file = event.target.files[0]
  console.log(file)
  selectedFile.value = file
}
```

在瀏覽器的開發者工具（Console）中，這顆 `File` 物件印出來會長這樣：

```js
File {
  name: "圖片壓縮.jpeg",
  size: 25475,
  type: "image/jpeg",
  lastModified: 1718592000000,
  lastModifiedDate: Sun Jun 17 2026 10:40:00 GMT+0800 (Taipei Standard Time),
  webkitRelativePath: ""
}
```

這個物件自帶 `name`、`size`、`type`、`lastModified` 等屬性，不需要在 HTML 裡設定什麼就能直接讀取（這裡的 `name` 指的是檔名，跟表單 `<input name="...">` 屬性是兩回事，只是剛好同名）。

同一份檔案在旅程的不同階段，會被不同工具包裝成不同的物件型態：

| | 前端 File 物件 | 後端 PersistentFile 物件 |
| --- | --- | --- |
| 存在位置 | 瀏覽器記憶體 | 伺服器硬碟（暫存路徑） |
| 檔名屬性 | `.name` | `.originalFilename` |
| 是否已上傳 | 還沒，只是選擇 | 已經傳送過來了 |
| 用途 | 顯示給使用者看 | 給 sharp 讀取處理 |

#### 2. 用 FormData 組裝上傳內容

```js
const formData = new FormData()
formData.append('image', selectedFile.value)   // key 要跟後端 files.image 對上
formData.append('quality', quality.value)
formData.append('width', width.value)
formData.append('format', format.value)
```

`FormData` 是瀏覽器內建物件，專門用來組裝表單資料，尤其是檔案。用程式碼組裝的效果，跟在 Postman 的 form-data 分頁手動填 key/value 是一樣的。

**為什麼我 `console.log(formData)` 看不到東西？**
如果你在測試時嘗試印出 `console.log(formData)`，你會發現在瀏覽器 Console 裡印出來只是空空的 `FormData {}`。這常常讓許多人以為自己「沒有把資料放進去」。

其實資料已經裝進去了！只是瀏覽器隱藏了 FormData 的內部細節。如果你想用 log 驗證裡面到底裝了什麼，必須透過 `entries()` 把資料一筆一筆拿出來看：

```js
// 正確檢查 formData 內容的方法
for (let [key, value] of formData.entries()) {
  console.log(`${key}:`, value)
}
```

這時候你在瀏覽器的 Console 就會看到剛剛成功裝進去的結構：
```js
image: File { name: "圖片壓縮.jpeg", size: 25475, type: "image/jpeg", ... }
quality: "70"
width: "800"
format: "webp"
```
從 log 印出的 `image:` 就能明顯看出，這正是為什麼後端要用 `files.image` 來接收，兩邊的 key 必須完全對上。

#### 3. `responseType: 'blob'` 的必要性

```js
const response = await axios.post(`${API_URL}/upload`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  responseType: 'blob'   // 後端回傳的是圖片二進位資料，不是 JSON
})
```

這個設定很關鍵。後端回傳的不是 JSON 文字而是圖片的二進位資料，如果不設定，axios 會嘗試把圖片當成 JSON 解析，結果會拿到亂碼或直接報錯。

成功後，Console 看到的回應是這樣：

```js
{
  data: Blob { size: 41373, type: 'image/jpeg' },
  status: 200,
  headers: { 'content-type': 'image/jpeg' }
}
```

#### 4. 把 Blob 變成看得到的圖片

Blob 本身只是一段二進位資料，沒有網址也不能直接顯示。要用 `URL.createObjectURL()` 把它包裝成瀏覽器能存取的臨時網址：

```js
const contentType = response.headers['content-type']
const extension = contentType.split('/')[1]

compressedImageUrl.value = URL.createObjectURL(response.data)
downloadFilename.value = `compressed.${extension}`
compressedSize.value = response.data.size
```

產生的網址格式類似 `blob:http://localhost:5173/xxxx-xxxx`，可以直接丟給 `<img>` 的 `src`。

```html
<img :src="compressedImageUrl" alt="壓縮後的圖片" />
<a :href="compressedImageUrl" :download="downloadFilename">下載圖片</a>
```

:::info
**下載的能力來自 `<a>` 標籤，不是 Blob**

`response.data` 純粹是被動的資料，它本身不知道什麼叫「下載」。真正決定下載行為的是 `<a>` 標籤的 `download` 屬性，這是 HTML 原生規格：瀏覽器看到這個屬性，就會把連結指向的資料存成檔案，而不是導航過去。

`download` 的值就是「下載後的檔名」，寫什麼就叫什麼。所以這裡用 `content-type` 動態推算副檔名，讓檔名跟實際格式一致，而不是固定寫死 `.jpg`。
:::

#### 5. 錯誤訊息的解析

因為設定了 `responseType: 'blob'`，即使後端用 `res.json()` 回傳錯誤訊息，到前端還是會被包成 Blob，不會自動解析。要手動轉回文字再 parse：

```js
catch (error) {
  if (error.response && error.response.data instanceof Blob) {
    try {
      const errorText = await error.response.data.text()
      const errorJson = JSON.parse(errorText)
      errorMessage.value = errorJson.error || '上傳失敗，請稍後再試'
    } catch {
      errorMessage.value = '上傳失敗，請稍後再試'
    }
  } else {
    errorMessage.value = '上傳失敗，請確認網路連線或稍後再試'
  }
}
```

`Blob.text()` 是 Blob 物件內建的方法，把二進位資料轉成文字字串。因為我們知道後端回傳的其實是 JSON，只是被當成二進位處理了。

### 五、部署：環境變數與 CORS

#### 1. 不要把 API 網址寫死

本機開發時打 `localhost:3000`，部署後要打 Render 的網址。如果直接改成正式網址，之後在本機測試新功能時，前端會一直打去線上的舊版後端，改了後端卻測不到。

Vite 內建支援環境變數，可以讓兩種情境自動切換。在專案根目錄建立兩個檔案：

```bash
# .env.development（本機開發時使用）
VITE_API_URL=http://localhost:3000

# .env.production（正式部署時使用）
VITE_API_URL=https://image-compress-backend.onrender.com
```

程式碼裡改成讀取環境變數：

```js
const API_URL = import.meta.env.VITE_API_URL
```

執行 `npm run dev` 時 Vite 自動讀 `.env.development`，執行 `npm run build` 時讀 `.env.production`，不需要手動切換。


#### 2. CORS 同時允許本機與正式環境

```js
const allowedOrigins = [
  'http://localhost:5173',                        // 本機開發
  'https://image-compress-frontend.vercel.app'    // 正式環境
]

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}))
```

這裡的 `origin` 是一個函式，用來動態檢查發出請求的網域是不是在我們的「白名單（`allowedOrigins`）」裡面。這段邏輯有幾個重點：

1. **為什麼要判斷 `!origin`？**
   當我們使用 Postman 或 curl 等開發工具測試 API 時，或者同網域互相打 API 時，請求通常不會帶有 `Origin` 這個 Header（此時 `origin` 的值會是 `undefined`）。加上 `!origin` 可以放行這些請求，讓我們能順利在本機用 Postman 測試。
2. **`allowedOrigins.includes(origin)`**：
   如果 `Origin` 存在，就檢查它有沒有在我們設定的陣列中。這樣就能同時允許本機開發（`localhost`）與正式上線（`vercel.app`）的請求。
3. **`callback(null, true)` 與 `callback(new Error(...))`**：
   這是 Node.js 慣用的回呼寫法。第一個參數代表錯誤（`null` 代表沒錯誤），第二個參數代表是否放行（`true` 代表允許）。如果不符合條件，就拋出一個 Error 把不合法的跨網域請求擋下來。

> **注意**：這段設定必須放在所有 API 路由（例如 `app.post('/upload')`）之前！因為 `app.use()` 註冊的是中介軟體（Middleware），請求進來必須先經過它完成 CORS 檢查，才能繼續往下走進你的 API 邏輯。


### 六、心得

#### 1. 部署平台的限制會回頭影響程式設計

一開始想的是「壓縮完存檔，給連結讓使用者下載」，直到理解 Render 免費方案的硬碟是非永久性的，才改成 `.toBuffer()` 直接回傳。

這不是程式寫得對不對的問題，而是同一段邏輯放在不同環境下，可靠度完全不同。選平台跟寫程式不是兩件獨立的事。

#### 2. 善用formidable 和 sharp
Formidable 和 Sharp 是 Node.js 處理檔案上傳和圖片處理的強大工具。Formidable 可以方便地解析 FormData，而 Sharp 則提供了高效的圖片壓縮功能。透過這兩個工具的結合，可以輕鬆實現圖片壓縮功能。


### 七、資料來源

1. [formidable 官方文件](https://github.com/node-formidable/formidable)
2. [sharp 官方文件](https://sharp.pixelplumbing.com/)
3. [Vite 環境變數與模式](https://vitejs.dev/guide/env-and-mode.html)
4. [MDN：FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
5. [MDN：URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL)
6. [Render 官方文件：Free Instance Types](https://render.com/docs/free)