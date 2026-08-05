---
slug: vue-firebase-chatroom
title: Roomly 即時聊天室
authors: [7lun]
tags: [project, Vue, Firebase]
date: 2026-06-13
---

### 前言

這次的目標，是使用 Vue 3 與 Firebase，開發一個具備登入功能的即時聊天室。
功能看似簡單：登入、發送訊息、即時同步更新。但實際開發後才發現，背後仍有許多需要思考的問題，例如登入方式、資料權限、即時監聽的解除時機，以及多聊天室的資料結構設計。

這篇文章會整理 Firebase API 的使用方式、開發過程中的踩雷紀錄，以及各項設計決策背後的思考。


- **Live Demo**：[**Roomly**](https://roomly-azure.vercel.app/)
- **GitHub**：[**GitHub Repo**](https://github.com/MalricHsu/roomly)
- **使用技術**：`Vue 3` / `Composition API` / `Vite` / `Vue Router` / `Firebase Authentication` / `Cloud Firestore`
- **專案時程**：2026.06.12 ~ 2026.06.13
- **網站部署**：Vercel


{/* truncate */}


### 一、Firebase介紹及基礎操作概念

#### 1. 為什麼選擇使用Firebase

在開始製作聊天室前，先想一個問題：為什麼不自己架後端，而是選擇 Firebase？
因為自行開發即時聊天室，除了伺服器和資料庫，還要處理 WebSocket 等即時通訊機制，對練習專案來說成本較高。

Firebase 是 Google 提供的 BaaS（後端即服務），主要優點包括：

**1. 免架伺服器與資料庫**：Authentication 負責登入，Firestore 負責儲存資料。<br/>
**2. 支援即時同步**：透過 `onSnapshot`，資料更新時畫面可以立即同步。<br/>
**3. 容易整合前端**：可直接使用 SDK 與 Vue 串接，不需要另外開發 API。

因此，Firebase 很適合用來快速完成以前端實作為主的即時聊天室。不過，資料存取權限仍需要透過 Firebase Security Rules 妥善設定。

> Firebase 的免費方案（Spark 方案）雖然夠一般練習專案使用，但不是完全沒有限制。以這次用到的服務來說，Authentication 的 Email/密碼登入在 50,000 個 MAU（月活躍使用者）以內免費；Firestore 則是有每日讀寫次數上限（例如每天 50,000 次讀取）跟 1 GiB 的儲存空間上限，超過額度就需要升級到 Blaze（用量計費）方案才能繼續使用。對於小型專案來說幾乎不會碰到上限，但如果之後想放上正式流量，記得先查一下當下最新的方案內容，因為 Firebase 的免費方案條款過去有調整過。

![firebase-architecture](/img/Chat1.png)

:::info
**名詞介紹**
1. BaaS（Backend as a Service，後端即服務）：指將後端功能以雲端服務形式提供的解決方案，開發者只需要專注在前端開發，不需要管理伺服器、資料庫、身分驗證等後端事務。
2. SDK（軟體開發工具包）：官方提供的一組開發工具與功能，讓開發者可以直接使用，例如登入、讀取資料或即時監聽，不需要從零開始撰寫。
:::

#### 2. Firebase 這次使用的服務
Firebase 提供許多服務，這次的聊天室主要使用兩個核心模組：**Authentication**（身份驗證）與 **Cloud Firestore**（資料庫）。

**1. Authentication（身份驗證）**<br/>
Authentication 負責確認「使用者是誰」，當使用者透過 Email 和密碼註冊或登入時，Firebase 會協助處理帳號驗證、密碼安全儲存，以及登入狀態的維持。即使重新整理頁面，也能判斷使用者是否仍處於登入狀態，不需要自己建立一套帳號系統。

**2. Cloud Firestore（資料庫）**<br/>
Firestore 是一種 NoSQL 文件型資料庫，資料主要由 collection（集合）和 document（文件）組成。可以把 collection 想成資料分類，而 document 則是其中的一筆資料。

這次會建立一個名為 `messages` 的 collection，裡面的每一筆 document 都代表一則聊天室訊息，例如訊息內容、發送者與發送時間。

**3.聊天室的資料怎麼流動**<br/>
當使用者送出訊息時，前端會將訊息寫入 `messages` collection。所有開啟聊天室的使用者，也會同時監聽這個 collection。

只要 Firestore 中新增了一則訊息，Firebase 就會主動通知正在監聽的前端，讓畫面立即顯示最新內容，不需要重新整理頁面，也不需要每隔幾秒重新查詢資料。

**簡單來說：Authentication 負責管理「誰正在使用聊天室」，Firestore 則負責「儲存訊息並同步更新」。**

![firebase-architecture2](/img/Chat2.png)


### 二、Firebase 初始化：firebase.js

初始化寫法參考自 [**Firebase 官方文件**](https://firebase.google.com/docs/web/setup)，屬於 v9 之後的 Modular Web SDK 寫法。

在專案中建立 `src/firebase.js`，集中管理 Firebase 的設定與服務實例。之後不論是註冊、登入、讀取訊息或發送訊息，都可以直接從這個檔案引入需要的服務。

```js
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: '你的 apiKey',
  authDomain: '你的 authDomain',
  projectId: '你的 projectId',
  storageBucket: '你的 storageBucket',
  messagingSenderId: '你的 messagingSenderId',
  appId: '你的 appId'
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
```

**這段程式碼有幾個重要觀念**

`initializeApp(firebaseConfig)` 是 Firebase SDK 的初始化入口。它會根據 `firebaseConfig` 中的專案設定，建立一個 Firebase App 實例。

在一般只連接一個 Firebase 專案的應用程式中，初始化通常只需要執行一次。後續使用的 Authentication、Firestore 等服務，都會基於這個 `app` 實例建立。

```js
const app = initializeApp(firebaseConfig)
```

`getAuth(app)` 與 `getFirestore(app)` 則分別取得 Authentication 和 Cloud Firestore 的服務實例。

```js
export const auth = getAuth(app)
export const db = getFirestore(app)
```

將它們匯出後，其他元件或功能檔案就不需要重複初始化 Firebase，只要直接引入即可：

```js
import { auth, db } from '@/firebase'
```

例如，登入與註冊功能會使用 `auth`，聊天室訊息的新增、查詢與即時監聽則會使用 `db`。

:::info
**apiKey 出現在前端程式碼裡，安全嗎？**
 
第一次看到自己的 `apiKey` 打包後會出現在瀏覽器下載的 JS 檔案裡（打開開發者工具就找得到），直覺會覺得「這樣不就被看光了嗎」。但這其實是正常現象，原因要從 apiKey 真正的功能講起。
 
apiKey **不是密碼，也不是用來檢查權限的鑰匙**。它的作用只是告訴 Firebase 伺服器：「這個請求是從哪一個 Firebase 專案發出來的」，方便 Firebase 做路由跟計費，僅此而已。它從設計上就不是拿來保密的東西，所以官方也不建議、也沒必要把它藏起來（用 `.env` 也藏不住，前端打包後一樣會被看到）。
 
真正決定「誰能讀、誰能寫資料」的，是另一個東西：**Firestore 安全規則**。這份規則才是真正的守門員，跟 apiKey 有沒有曝光完全無關。
 
用生活中的例子理解會比較直覺：apiKey 就像你家的**門牌號碼**。地址寫在門口，任何人經過都看得到，這不是秘密。但知道地址、走到你家門口，不代表就能進去——能不能進去，看的是**門有沒有上鎖**。安全規則就是那道鎖。鎖沒上好，就算地址沒人知道也不安全；鎖上好了，地址公開也沒關係。
 
**重點是：不用去藏 apiKey，而是要把 Firestore 安全規則設對、設嚴謹，那才是真正保護資料的地方。**
:::
 
### 三、Firebase Authentication：登入機制

#### 1.登入方式的選擇

開始實作登入功能之前，先確認聊天室適合採用哪一種身份驗證方式。

Firebase Authentication 支援多種登入機制，這次主要評估以下三種方案：

| 方案          | 使用者需要提供的資訊     | 優點                    | 缺點                              |
| ----------- | -------------- | --------------------- | ------------------------------- |
| 匿名登入搭配姓名    | 只需要輸入名稱        | 操作門檻最低，能快速進入聊天室       | 更換裝置後會被視為新的使用者，也可能出現冒用名稱的情況     |
| Email 與密碼登入 | Email、密碼       | 能建立可持續使用的個人帳號，身份辨識較完整 | 需要考慮密碼驗證、忘記密碼與錯誤提示等流程           |
| Google 登入   | 點擊 Google 登入按鈕 | 操作快速，不需要另外記憶密碼        | 需要額外設定 Google 登入供應商與 OAuth 相設定 |

綜合使用情境與專案目標後，最後選擇使用 **Email 與密碼登入**。

雖然這種方式需要處理較多登入細節，但能完整呈現帳號註冊、登入狀態管理、表單驗證與錯誤處理等流程，也更適合作為 Firebase Authentication 的實作練習。

#### 2. 註冊：`createUserWithEmailAndPassword`

```js
import {
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth'
import { auth } from '../firebase'

const handleRegister = async () => {
  try {
    // 建立 Email 與密碼帳號
    const result = await createUserWithEmailAndPassword(
      auth,
      email.value,
      password.value
    )

    // 將姓名寫入 displayName
    await updateProfile(result.user, {
      displayName: name.value
    })

    router.push('/room-select')
  } catch (err) {
    errorMsg.value =
      errorMessages[err.code] || '註冊失敗，請稍後再試'
  }
}
```

`createUserWithEmailAndPassword` 只接受 Email 與密碼，無法同時設定姓名，因此註冊流程需要分成兩步：

1. 建立使用者帳號。
2. 使用 `updateProfile` 將姓名寫入 `displayName`。

`result.user` 代表剛建立的使用者物件，之後可以透過 `auth.currentUser.displayName` 取得姓名。

Firebase 發生錯誤時，會回傳固定格式的 `err.code`，可以將它轉換成較容易理解的中文訊息：

```js
const errorMessages = {
  'auth/email-already-in-use': '這個 Email 已經被註冊過了',
  'auth/invalid-email': 'Email 格式不正確',
  'auth/weak-password': '密碼至少需要 6 個字元'
}
```

#### 3. 登入：`signInWithEmailAndPassword`

```js
import { signInWithEmailAndPassword } from 'firebase/auth'

const handleLogin = async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    )

    router.push('/room-select')
  } catch (err) {
    errorMsg.value =
      errorMessages[err.code] || '登入失敗，請稍後再試'
  }
}
```

登入成功後，Firebase 會自動保存登入狀態。即使重新整理頁面，使用者通常仍會維持登入，不需要自行操作 Cookie 或 `localStorage`。

#### 4. 忘記密碼：`sendPasswordResetEmail`

```js
import { sendPasswordResetEmail } from 'firebase/auth'

const handleReset = async () => {
  try {
    await sendPasswordResetEmail(auth, email.value)
    message.value = '重設密碼信件已寄出，請檢查信箱'
  } catch (err) {
    message.value = '發生錯誤，請確認 Email 是否正確'
  }
}
```

呼叫 `sendPasswordResetEmail` 後，Firebase 會自動寄出重設密碼信件。使用者點擊信件中的連結後，就能重新設定密碼，不需要自行建立寄信服務。

#### 5. 登出：`signOut`

```js
import { signOut } from 'firebase/auth'

const handleLogout = async () => {
  await signOut(auth)
  router.push('/')
}
```

`signOut` 會清除目前的 Firebase 登入狀態，完成後再將使用者導回首頁。

#### 6. 監聽登入狀態：`onAuthStateChanged`

Firebase 讀取登入狀態是非同步的。頁面剛載入時，無法立刻確定使用者是否已登入，因此需要透過 `onAuthStateChanged` 監聽狀態變化。

在 `src/auth.js` 建立共用的登入狀態：

```js
import { ref } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'

export const currentUser = ref(null)
export const authReady = ref(false)

onAuthStateChanged(auth, (user) => {
  currentUser.value = user
  authReady.value = true
})
```

`onAuthStateChanged` 不只會執行一次，而是會持續監聽登入狀態。當使用者登入、登出、重新整理頁面或登入狀態失效時，都會重新觸發 callback。

其中：

* `currentUser`：已登入時保存使用者物件，未登入時為 `null`。
* `authReady`：表示 Firebase 已完成第一次登入狀態確認。

`authReady` 可以避免路由守衛在 Firebase 尚未確認登入狀態前，就過早判斷使用者未登入。這部分會在路由守衛章節進一步說明。


### 四、路由守衛：等待 Firebase 確認登入狀態

路由守衛的判斷本身不複雜，但有一個常見問題：Firebase 讀取登入狀態需要一點時間。

頁面剛載入時，`currentUser` 的初始值是 `null`。這不一定代表使用者沒有登入，也可能只是 Firebase 還沒完成檢查。

因此，必須先等待 `authReady` 變成 `true`，確認 Firebase 已完成第一次登入狀態檢查，再執行路由判斷。

```js
router.beforeEach(async (to, from, next) => {
  // 等待 Firebase 完成第一次登入狀態檢查
  if (!authReady.value) {
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (authReady.value) {
          clearInterval(interval)
          resolve()
        }
      }, 50)
    })
  }

  // 需要登入，但目前沒有使用者
  if (to.meta.requiresAuth && !currentUser.value) {
    next('/')
    return
  }

  next()
})
```

**這段流程可以拆成三步：**

1. 進入路由守衛時，先檢查 `authReady`。
2. 如果 Firebase 尚未確認完成，就暫停路由流程。
3. 確認完成後，再根據 `currentUser` 判斷是否允許進入頁面。

`setInterval` 會每隔 50 毫秒檢查一次 `authReady.value`。當它變成 `true` 時，就停止計時器並執行 `resolve()`，讓路由守衛繼續往下執行。

需要登入才能瀏覽的頁面，可以在路由設定中加入：

```js
{
  path: '/chat/:roomId',
  name: 'chat',
  component: Chat,
  meta: {
    requiresAuth: true
  }
}
```

當使用者進入這個路由時，路由守衛會檢查兩個條件：

```js
to.meta.requiresAuth && !currentUser.value
```

意思是：

* 這個頁面需要登入。
* 目前沒有登入中的使用者。

兩個條件都成立時，才會將使用者導回登入頁。


### 五、Cloud Firestore：訊息的讀寫與即時監聽

#### 1.資料結構設計

這次的資料設計沒有建立多個 collection，所有聊天室的訊息都放在同一個 `messages` collection 裡，靠 `roomId` 欄位區分是哪個房間：

```
messages (collection)
  └─ {messageId}（Firestore 自動產生的 ID）
      ├─ text: string        訊息內容
      ├─ uid: string         發送者的 uid
      ├─ displayName: string 發送者的姓名
      ├─ roomId: string      這則訊息屬於哪個房間
      └─ createdAt: timestamp 發送時間（Firestore server 時間）
```

#### 2.發送訊息：addDoc + serverTimestamp

```js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const handleSend = async () => {
  if (!newMessage.value.trim()) return  // 防呆：不送空白訊息

  await addDoc(collection(db, 'messages'), {
    text: newMessage.value,
    uid: currentUser.value.uid,
    displayName: currentUser.value.displayName,
    roomId: roomId,
    createdAt: serverTimestamp()  // 用伺服器時間，不用使用者裝置時間
  })

  newMessage.value = ''
}
```

`addDoc` 會在指定的 collection 裡新增一筆文件，Firestore 會自動幫這筆文件產生一個唯一 ID，不需要自己管理。

`serverTimestamp()` 是 Firestore 提供的特殊寫法，意思是「用 Firebase 伺服器當下的時間」，不是使用者裝置的時間。這樣可以避免使用者手機時間設錯導致訊息排序出問題。

#### 3. 即時監聽訊息：`onSnapshot`

`onSnapshot` 是聊天室能即時更新的關鍵。

一般使用 `getDocs()` 讀取資料時，只會取得呼叫當下的結果；`onSnapshot()` 則會持續監聽查詢結果。當有人新增、修改或刪除訊息時，callback 會再次執行，畫面也會跟著更新。

```js
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore'

const messages = ref([])
let unsubscribe = null

onMounted(() => {
  // 建立聊天室訊息的查詢條件
  const q = query(
    collection(db, 'messages'),
    where('roomId', '==', roomId),
    orderBy('createdAt')
  )

  // 開始監聽查詢結果
  unsubscribe = onSnapshot(q, (snapshot) => {
    messages.value = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))
  })
})

onUnmounted(() => {
  // 離開頁面時停止監聽
  if (unsubscribe) {
    unsubscribe()
  }
})
```

首先，`query()` 會把查詢條件組合起來：

```js
const q = query(
  collection(db, 'messages'),
  where('roomId', '==', roomId),
  orderBy('createdAt')
)
```

這段代表：

* 從 `messages` collection 讀取資料。
* 只取得目前聊天室的訊息。
* 按照 `createdAt` 由舊到新排序。

接著，把建立好的查詢交給 `onSnapshot()`：

```js
unsubscribe = onSnapshot(q, (snapshot) => {
  // 處理最新的查詢結果
})
```

開始監聽後，callback 會先執行一次，取得目前已有的訊息。之後只要符合查詢條件的資料發生變化，callback 就會再次執行。

`snapshot.docs` 是目前符合條件的所有文件，每個 `doc` 都是 Firestore 的文件物件：

```js
messages.value = snapshot.docs.map((doc) => ({
  id: doc.id,
  ...doc.data()
}))
```

其中：

* `doc.id`：取得文件 ID，之後可用於刪除或修改訊息。
* `doc.data()`：取得文件內的欄位，例如 `text`、`uid`、`displayName` 與 `createdAt`。

`onSnapshot()` 會回傳一個停止監聽的函式，因此將它保存到 `unsubscribe`：

```js
unsubscribe = onSnapshot(...)
```

當聊天室元件卸載時，再呼叫這個函式關閉監聽：

```js
onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
```

如果沒有停止監聽，使用者每次進入聊天室都可能新增一個監聽器，造成相同資料被重複處理，也會浪費資源。


:::caution
`where` 跟 `orderBy` 同時使用，Firestore 會要求建立**複合索引**。第一次執行這個查詢時，Console 會出現錯誤訊息並附上一個連結，點進去 Firebase 會自動幫你填好索引設定，按「建立」等幾分鐘就好，不需要手動設定欄位。
:::

![firebase-architecture](/img/Chat3.png)

#### 4. 新訊息自動捲動到底部

當 `onSnapshot` 收到新訊息後，`messages` 陣列會更新，但 Vue 不會在同一瞬間完成畫面更新。

因此，如果在更新 `messages` 後立刻計算捲動高度，可能會取得更新前的高度，導致捲軸沒有正確移到最底部。這時就需要使用 `nextTick()`，等待 Vue 把最新訊息渲染到畫面後，再操作 DOM。

```js
import { ref, watch, nextTick } from 'vue'

const messagesContainer = ref(null)

watch(messages, async () => {
  await nextTick()

  if (messagesContainer.value) {
    messagesContainer.value.scrollTop =
      messagesContainer.value.scrollHeight
  }
})
```

在 template 中，將 `messagesContainer` 綁定到訊息容器：

```html
<div ref="messagesContainer">
  <!-- 訊息列表 -->
</div>
```

整個流程如下：

1. `messages` 收到新資料。
2. `watch()` 偵測到資料改變。
3. `nextTick()` 等待 Vue 更新畫面。
4. 畫面更新完成後，再將捲軸移到最底部。

可以把 `nextTick()` 理解成：**等 Vue 把最新資料畫到畫面上，再繼續執行後面的程式**。

`scrollHeight` 是容器內所有內容的總高度，包含目前看不到的部分；`scrollTop` 則是目前捲動的位置。

```js
messagesContainer.value.scrollTop =
  messagesContainer.value.scrollHeight
```

將目前捲動位置設為內容總高度，就能把訊息容器移到最底部。

![firebase-architecture](/img/Chat5.png)

#### 5.時間格式轉換

Firestore 回傳的 `createdAt` 是一個特殊的 Timestamp 物件，不能直接顯示，要先轉換：

```js
const formatTime = (timestamp) => {
  if (!timestamp) return ''  // 剛發送的瞬間 server 時間還沒回填，先返回空字串
  const date = timestamp.toDate()  // 轉成 JavaScript 原生的 Date 物件
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}
```

`timestamp.toDate()` 是 Firestore Timestamp 物件的方法，把它轉成一般的 JS `Date` 物件，之後就能用熟悉的方式格式化時間了。


### 六、多房間設計

#### 1. 讓使用者自己輸入代碼進入房間

房間代碼放進路由路徑，網址設計成 `/chat/:roomId`：

```js
// router/index.js
{
  path: '/chat/:roomId',
  name: 'chat',
  component: Chat,
  meta: { requiresAuth: true }
}
```

使用者在「選擇房間」頁輸入任意字串，直接導航過去：

```js
// RoomSelect.vue
const enterRoom = () => {
  const trimmed = roomCode.value.trim()
  if (!trimmed) return
  router.push(`/chat/${trimmed}`)
}
```

聊天室裡從路由參數讀出 roomId，套進查詢條件：

```js
import { useRoute } from 'vue-router'

const route = useRoute()
const roomId = route.params.roomId  // 從網址 /chat/abc123 取出 abc123
```

這個設計最大的優點是「建立房間」這個動作根本不需要存在。只要有人發了第一則訊息到某個 `roomId`，那個房間就自然存在了；兩個人輸入同樣的代碼，就進入同一個房間。

![firebase-architecture](/img/Chat4.png)

### 七、Firestore 安全規則

Firestore 安全規則設定在 Firebase Console 的 **Firestore Database → 規則**，用來限制哪些人可以讀寫資料，以及寫入的內容是否符合要求。

以下規則套用在 `messages` collection：

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /messages/{messageId} {

      // 只有已登入的使用者可以讀取訊息
      allow read: if request.auth != null;

      // 新增訊息時必須符合以下條件
      allow create: if request.auth != null
                    && request.resource.data.uid == request.auth.uid
                    && request.resource.data.text is string
                    && request.resource.data.text.size() > 0
                    && request.resource.data.text.size() <= 1000
                    && request.resource.data.roomId is string
                    && request.resource.data.roomId.size() > 0;

      // 不允許修改或刪除已送出的訊息
      allow update, delete: if false;
    }
  }
}
```

這段規則主要限制三件事：

* 使用者必須先登入，才能讀取或新增訊息。
* 訊息中的 `uid` 必須和目前登入者的 `uid` 相同，避免冒用別人的身份發言。
* `text` 必須是 1～1000 字的字串，`roomId` 也必須是非空字串。

其中：

```javascript
request.auth
```

代表目前登入者的身份資訊；`request.auth.uid` 是這位使用者真正的 UID。

```javascript
request.resource.data
```

則代表這次準備寫入 Firestore 的資料。

因此這一行：

```javascript
request.resource.data.uid == request.auth.uid
```

會比對「訊息資料中填寫的 UID」和「實際登入者的 UID」。

即使有人繞過網頁畫面，直接呼叫 Firebase API 並填入別人的 UID，只要兩者不一致，Firestore 就會拒絕這次寫入。


### 八、用 Admin SDK 清除測試資料

開發過程中可能會累積大量測試訊息，但前端 Firebase SDK 仍會受到 Firestore 安全規則限制。
由於目前規則設定為：

```javascript
allow delete: if false;
```

前端無法刪除訊息，因此需要透過 **Firebase Admin SDK** 執行清除操作。
Admin SDK 擁有專案的管理權限，不受 Firestore 安全規則限制，適合用來執行只有開發者能操作的資料管理工作。
首先，前往：**Firebase Console → 專案設定 → 服務帳戶 → 產生新的私密金鑰**，下載 Service Account 的 JSON 金鑰後，記得將它加入 `.gitignore`，絕對不能上傳到 GitHub。

接著建立一個獨立的 Node.js 腳本，不要放到前端程式中執行：

```js
// clearMessages.js
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const serviceAccount = require('./serviceAccountKey.json')

initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore()

async function clearMessages() {
  const snapshot = await db.collection('messages').get()
  const batch = db.batch()

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref)
  })

  await batch.commit()

  console.log(`已刪除 ${snapshot.size} 筆訊息`)
}

clearMessages()
```

程式會先讀取 `messages` collection 中的所有文件，再透過 `db.batch()` 將多筆刪除操作集中送出。
相較於逐筆呼叫 `delete()`，批次寫入效率較高，而且同一批操作會一起成功或一起失敗，避免資料只刪除一部分。

:::caution
**注意版本差異**。`firebase-admin` 14.x 版已經把各功能拆成子模組，舊版（11.x 以前）的寫法 `admin.credential.cert()` 跟 `admin.firestore()` 在新版都不存在了，會直接報錯。要從對應的子路徑 import：`firebase-admin/app` 跟 `firebase-admin/firestore`。
:::


### 九、心得

**1. 安全的關鍵是規則，不是隱藏金鑰。**
一開始花了不少時間研究 `apiKey` 能不能放在前端，以及使用 `.env` 是否能提升安全性。後來才理解，Firebase Web API Key 本來就會出現在前端，真正控制資料存取權限的是 Firestore 安全規則。與其想辦法隱藏 `apiKey`，更重要的是正確設定讀寫條件。

**2. 即時監聽開始後，也要記得停止。**
`onSnapshot` 建立的監聽不會在離開頁面時自動關閉，因此需要保存它回傳的 `unsubscribe` 函式，並在 `onUnmounted` 中執行。這次實作讓我更具體地理解 Vue 生命週期：元件建立時開始監聽，元件卸載時清除監聽。

**3. 理解 API 的行為，比記住寫法更重要。**
`addDoc`、`getDocs` 與 `onSnapshot` 都是在操作 Firestore，但用途並不相同：`addDoc` 負責新增資料、`getDocs` 只讀取一次，`onSnapshot` 則會持續監聽資料變化。查詢是否包含篩選、排序，以及是否需要建立索引，也會影響程式與資料流程。理解每個 API 實際在做什麼，是這次開發中最重要的收穫。
