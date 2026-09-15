# 設定教學：GitHub Pages + Google 雲端

這份教學把目前可操作的示範網站切換成正式班級系統。需要儲存庫管理權限，以及用來管理教會資料的 Google 帳號。

**GitHub 與 Google 是兩次獨立部署。GitHub 測試成功不代表 Google 後端已建立。** 已支援中文三時段課表與原有 Courses 標準格式；程式只讀取課表，不會改動來源的內容、排版或分享設定。

## 1. 啟用 GitHub Pages

1. 開啟[儲存庫 Pages 設定](https://github.com/timmywu30/tjc-classroom/settings/pages)。
2. Build and deployment → Source 選擇 **GitHub Actions**。
3. 開啟 [Actions](https://github.com/timmywu30/tjc-classroom/actions)，執行或重新執行 Verify and deploy classroom。
4. verify 與 deploy 都成功後，開啟 [班級網站](https://timmywu30.github.io/tjc-classroom/)。

目前 public/config.js 的 mode 為 demo。上方可切換家長、教員、班負責。示範資料只在當前瀏覽器；不同裝置不共用。可以先檢查操作，再設定 Google。

若 deploy 顯示找不到 Pages site，先完成第 2 步，再重新執行失敗工作。不需要改成 Deploy from a branch；本專案需要 Vite 建置。

## 2. 建立 Firebase Google 登入

1. 開啟 [Firebase Console](https://console.firebase.google.com/)，建立教會管理的專案。
2. Authentication → Sign-in method，啟用 Google，設定專案支援 Email。
3. Authentication → Settings → Authorized domains，新增 timmywu30.github.io。若用自訂網域，也加入該網域；本機開發則自行加入 localhost。
4. Project settings → Your apps，新增 Web App，記下 apiKey、authDomain、projectId、appId。
5. 本系統只使用 Firebase Authentication，不需建立 Firestore、Realtime Database 或 Storage。

Firebase 的 Web 設定用來識別專案，可以放在網站；服務帳戶 JSON、私人金鑰與管理員名單不能放進 GitHub。

後端需呼叫 Identity Toolkit 的 accounts:lookup 驗證登入憑證。指令碼屬性 FIREBASE_WEB_API_KEY 可使用同專案的 API key；如果瀏覽器 key 已設定 HTTP referrer 限制，請另外建立同專案、限 Identity Toolkit API 使用的 key 給 Apps Script，勿把瀏覽器 referrer 限制套在伺服器請求上。前台 key 依 Firebase 所需 API 設定限制；不要任意停用 Authentication 需要的 API。

## 3. 建立 Apps Script 專案

1. 用管理資料的 Google 帳號開啟 [Apps Script](https://script.google.com/)，建立新專案，名稱例如「幼年班管理系統」。
2. 將本儲存庫下列檔案完整貼到同名檔案：

| 儲存庫檔案 | Apps Script 檔案 |
| --- | --- |
| apps-script/Code.gs | Code.gs |
| apps-script/Domain.gs | Domain.gs |
| apps-script/Schedule.gs | Schedule.gs |
| apps-script/Bridge.html | Bridge.html，新增類型選 HTML |
| apps-script/appsscript.json | appsscript.json |

3. 專案設定中開啟「在編輯器中顯示 appsscript.json 資訊清單檔案」，才能編輯 manifest。
4. 確認左側「服務」已有 **Google Sheets API v4（Sheets）**。manifest 已宣告此服務；若使用自行指定的 Google Cloud 專案，也需在該 Cloud 專案啟用 Google Sheets API。
5. 專案時區為 Asia/Taipei，保留 V8 執行環境。

只有 doGet 與 rpc 是對瀏覽器開放的函式。結尾為底線的 setup_、dailyBackup_、restoreBackup_ 必須從 Apps Script 編輯器選取執行。

## 4. 設定指令碼屬性並初始化

Apps Script → 專案設定 → 指令碼屬性，加入：

| 名稱 | 值 |
| --- | --- |
| ADMIN_EMAIL | 第一位班負責實際用來登入的 Google Email |
| FIREBASE_PROJECT_ID | Firebase 的 projectId |
| FIREBASE_WEB_API_KEY | 同 Firebase 專案、可供 Apps Script 呼叫 Auth API 的 key |
| ALLOWED_ORIGINS | https://timmywu30.github.io |

ALLOWED_ORIGINS 使用 origin，不加 /tjc-classroom/ 或尾斜線。多個來源以逗號分隔，例如 https://timmywu30.github.io,http://localhost:5173；正式使用時移除不需要的測試來源。

回到編輯器，選取 **setup_** → 執行，以專案擁有者完成 Google 授權。此程式會：

- 建立「幼年班管理系統」限制存取的 Drive 資料夾。
- 建立「課堂照片」與「資料備份」資料夾。
- 建立班級資料試算表與獨立課表試算表。
- 以 ADMIN_EMAIL 建立第一位班負責，不加入虛構學員。
- 建立初始學期 term_115_1、班級 children。
- 建立每天約台灣時間凌晨 2 點執行的備份觸發器。

執行記錄會列出新試算表連結。下列屬性會自動產生，勿填入公開 config.js：

ROOT_FOLDER_ID、PHOTO_FOLDER_ID、BACKUP_FOLDER_ID、DATA_SPREADSHEET_ID、SCHEDULE_SPREADSHEET_ID。

重新執行 setup_ 會保留已設定資源與資料；不要任意刪除資源 ID 造成建立另一套空資料。

## 5. 部署 Google 網頁應用程式

1. 部署 → 新增部署作業 → 類型選「網頁應用程式」。
2. 執行身分選「我」，讓程式以管理資料帳號存取私人 Sheets／Drive。
3. 誰可以存取選「任何人」。
4. 部署並複製 https://script.google.com/macros/s/…/exec 網址。

「任何人」僅允許載入連線頁面；每一個資料請求仍需 Firebase 憑證及本系統帳號授權。不要改為公開分享資料試算表或照片。

若 Google Workspace 管理政策不允許此部署選項，需由組織管理員調整政策或另外評估 API 主機。單純改前端權限不能解決。

日後修改 Code.gs、Domain.gs、Schedule.gs 或 Bridge.html 時，到「管理部署作業」編輯現有部署並選擇新版本。保留既有 /exec 網址即可。

## 6. 切換網站設定

在 GitHub 編輯 public/config.js，填入自己的公開設定：

~~~js
window.CLASSROOM_CONFIG = {
  mode: "google",
  appsScriptUrl: "https://script.google.com/macros/s/你的部署編號/exec",
  firebase: {
    apiKey: "你的瀏覽器 Firebase API key",
    authDomain: "你的專案.firebaseapp.com",
    projectId: "你的專案編號",
    appId: "你的 Web App ID"
  }
};
~~~

提交後等待 Actions 成功。正式模式出現設定或連線錯誤時，網站會顯示錯誤，不會自動改用示範資料。

用 ADMIN_EMAIL 登入。第一次成功會把登入 UID 綁到 Users 資料表；後續以 UID 辨識。班負責進入「學員管理」新增學員，再到「帳號與家長關聯」開通家長與教員。

## 7. 維護 Google 課表

### A. 使用原本的中文三時段課表（建議）

來源須為原生 Google 試算表，Apps Script 專案擁有者需有讀取權限。無須發布到網路，也不必讓家長取得試算表權限。

先完成第 4 節初始化，再到「指令碼屬性」設定：

| 名稱 | 值／用途 |
| --- | --- |
| SCHEDULE_SPREADSHEET_ID | 原始 Google 課表的試算表 ID，取代初始化產生的空課表 ID |
| SCHEDULE_SHEET_NAME | 課表 |
| SCHEDULE_TERM_ID | term_115_1；必須對應班級資料 Terms 的 id |
| SCHEDULE_CLASS_ID | children |

這些來源設定只放在 Apps Script，不放進公開 config.js。若原始課表使用其他分頁名稱，在 SCHEDULE_SHEET_NAME 填入其完整名稱。

支援的表頭與用途：

| 原始欄位 | 網站顯示 |
| --- | --- |
| 日期 | 每次聚會日期、星期與點名課程 |
| 詩頌課 + 時間、詩頌/司琴 | 詩頌內容、詩頌教員及司琴 |
| 崇拜課 + 時間、崇拜課教員 | 崇拜主題、教員 |
| 共習課 + 時間、共習課教員 | 共習活動、教員 |
| 值星 | 當次值星 |
| 備註 | 當次準備事項或提醒 |
| 表頭上方標題 | 本季課表名稱 |
| 本季目標： | 家長與教員課表頁的本季目標 |
| 本季活動： | 近期活動頁，保留原文日期與時間 |
| 表底全寬合併的其他提醒 | 僅教員可見的工作提醒 |

時間直接讀取表頭，例如「詩頌課\n10:00~10:20」。日期可維持試算表日期格式，或填完整 YYYY-MM-DD。只有月日的文字無法確定年份，會顯示錯誤；系統不從民國學年度標題猜測日期。

支援同一列橫向合併：「詩頌＋崇拜」或「崇拜＋共習」會顯示為一個連續時段，使用合併範圍後的教員欄。不要將不同日期的課程直向合併。金句、經文與物品若未在來源提供，網站不會自動補寫。

**一列日期代表一次聚會，三個教學時段共用一筆點名與積分。** 課程 ID 依來源試算表、分頁及完整日期產生，因此插入空白列、修改主題或教員不會改變既有點名。已有點名後，請勿更改聚會日期、複製成另一個來源分頁或更換來源 ID，否則會被視為另一堂課。若預先需要同日多次聚會或未來調整日期，可在最右側新增「課程ID」欄並填固定且唯一的代碼；請在首次點名前完成，已有紀錄時勿直接補改 ID。

SCHEDULE_TERM_ID 明確綁定來源所屬學期，變更後台目前學期不會把舊課表移到新學期。換季時先建立 Terms 學期，再切換來源及其 SCHEDULE_TERM_ID；需要同時保留多學期課表供家長查閱時，可使用下方 Courses 格式集中保存歷季資料。程式不會自動將舊來源匯入或寫回。

完成設定後，在 Apps Script 編輯器執行 **checkSchedule_**。記錄會列出聚會筆數與起訖日期，不會印出學員資料。成功後依第 5 節部署新版本，再重新整理網站，核對三時段、合併安排、值星與本季活動。

日常只需編輯原課表儲存格；網站重新整理會重新讀取。課表上的活動是文字公告，若需要報名連結或活動封面，可另外從後台建立活動。

### B. 原有 Courses 標準格式（仍可使用）

將 SCHEDULE_SHEET_NAME 設為 Courses。第一列依序為：

~~~text
id,termId,classId,date,startTime,endTime,title,scripture,verse,song,teacher,materials,notes,status,resourceUrl
~~~

[下載課表 CSV 範本](../templates/courses.csv)。範本是一筆虛構課程，請換成正式內容。

| 欄位 | 說明 |
| --- | --- |
| id | 固定且不重複；已有點名後不可改 |
| termId / classId | 對應學期及班級代碼；初始 term_115_1 / children |
| date | YYYY-MM-DD，亦支援 Sheets 日期儲存格 |
| startTime / endTime | HH:mm，亦支援 Sheets 時間儲存格 |
| title / scripture / verse | 主題、經文範圍、完整金句 |
| song / teacher / materials / notes | 詩歌、教員、物品及備註 |
| status | normal 或 cancelled |
| resourceUrl | 選填 HTTPS 教材連結 |

英文表頭順序固定，第二列起填寫。可保留空白列、調整欄寬與顏色；標準表不要合併儲存格。相較中文格式，本格式的學期與班級直接取自各列，可放入多學期課程。

備份還原時，會自動在末尾加入 periods（時段 JSON 陣列）與 dutyTeacher（值星），並建立 ScheduleInfo 分頁保存本季資訊；這些擴充欄位與原本的 15 欄皆可被讀取。一般教員無須手動編輯 JSON，平日繼續用中文課表即可。

## 8. 連接既有 Google 學員名單

1. 在來源試算表建立 Students 分頁，依 [學員 CSV 範本](../templates/students.csv) 排列。
2. 第一列固定為 id,name,grade,classId,active,photoConsent。
3. active 與 photoConsent 填 TRUE 或 FALSE；沒有照片同意時填 FALSE。
4. 將來源 Sheet 的讀取權限給 Apps Script 擁有者。
5. 指令碼屬性加入 STUDENT_SOURCE_SPREADSHEET_ID，值只放試算表 ID。
6. 後台「學員管理 → 讀取雲端學員表」，核對預覽後儲存。

每次來源表限 1–100 筆。按 id 新增／更新，不按姓名比對，不刪除未出現在來源表的學員；相同 id 再匯入會更新姓名、年級、班級、在班與同意欄位。網站不會回寫來源表，也沒有未經確認的定時同步。使用固定 ID，避免用同名學員判斷身分。

## 9. 備份、還原與交接

每日備份為 JSON，存放在限制存取的「資料備份」資料夾；保留約 30 天。內容含課表與全部資料表，但不包含照片位元組。照片上傳版保留在照片資料夾；原始 RAW／高解析照片請另行保存。

班負責可從後台下載文字資料備份。自動還原只接受本系統每日備份資料夾中的檔案：

1. 暫停教員操作，先手動執行 dailyBackup_ 留下目前狀態。
2. 找到要還原的 JSON 檔案，在指令碼屬性填入 RESTORE_FILE_ID。
3. 從 Apps Script 執行 restoreBackup_。
4. 程式會建立新的班級資料與 Courses 格式課表，驗證基本備份結構後切換 ID 與分頁設定，保留原資料表。課程 ID、三時段、值星、本季目標、活動及教員提醒會一併保留；原始課表的顏色與合併排版不包含在 JSON 備份中。
5. 完成後重新整理網站，核對名單、積分、課表與照片。RESTORE_FILE_ID 會自動移除。

移交帳號時，Google 觸發器綁定建立者；請新管理者確認自己的授權與觸發器，再移除舊管理者的觸發器。保留至少一個可登入的班負責。

## 10. 正式使用前驗收

使用兩個家長帳號與一個教員帳號，確認：

- 家長 A、B 各自只能讀到綁定孩子的姓名、出席、金句與積分。
- 未開通 Google 帳號被拒絕，停用後下一次請求被拒絕。
- 教員點名／改狀態後，積分增減正確；重複操作不重複加分。
- 草稿相簿在家長端不可見；發布後可載入，移除照片後轉回草稿。
- 手機 Chrome 與 Safari 可登入、重整與查看照片。
- 課表修改可讀到，備份觸發器至少成功執行一次。
- Google 連線失敗時顯示錯誤；「重試上次儲存」沿用同一操作編號。

## 常見問題

| 畫面／錯誤 | 檢查 |
| --- | --- |
| Firebase auth/unauthorized-domain | Authorized domains 加入實際網站網域 |
| Google 帳號尚未開通 | Users 登記的 Email 是否與實際 Google 帳號一致 |
| 無法連接班級資料 | /exec 網址、網頁應用程式存取範圍、ALLOWED_ORIGINS 是否為完整 origin |
| 只有 iframe 或白頁 | 網站應開 GitHub Pages；Apps Script /exec 僅是資料連線頁 |
| Sheets is not defined | 啟用進階 Google Sheets API v4 |
| 分頁第一列欄位已變更 | 對照範本恢復表頭及順序 |
| API key referrer 錯誤 | Apps Script 使用的 key 不能限瀏覽器 referrer |
| 修改後端沒有生效 | 更新現有部署為新版本 |
| 有一筆儲存結果尚未確認 | 使用「重試上次儲存」，勿關閉分頁後重新建立同一筆調整 |
| Apps Script 執行時間／配額不足 | 檢查 Apps Script 執行紀錄與 Google 配額，減少同時照片載入與每日操作量 |

## 官方參考

- [Vite 的 GitHub Pages 部署](https://vite.dev/guide/static-deploy.html#github-pages)
- [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web)
- [HTML Service 通訊與私有函式](https://developers.google.com/apps-script/guides/html/communication)
- [Firebase Google 登入](https://firebase.google.com/docs/auth/web/google-signin)
- [Firebase Auth REST API](https://firebase.google.com/docs/reference/rest/auth)
- [Sheets 分頁與合併範圍](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/sheets)
- [Apps Script 進階 Sheets 服務](https://developers.google.com/apps-script/advanced/sheets)
- [Sheets 批次更新](https://developers.google.com/workspace/sheets/api/guides/batchupdate)
- [Apps Script 配額](https://developers.google.com/apps-script/guides/services/quotas)

