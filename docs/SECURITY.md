# 資料、權限與操作可靠性

## 儲存範圍

GitHub Pages 僅有靜態網站、公開 Firebase Web 設定及虛構示範資料。正式資料不寫入 GitHub、網址參數或前端 localStorage。

Google Drive 的主資料夾、資料試算表、照片與備份必須維持「限制存取」。程式不建立任何知道連結即可存取的照片分享權。Apps Script 以擁有者權限執行，因此擁有者及 Apps Script 編輯者屬於信任範圍；只有班負責可持有主資料表編輯權。

## 身分與授權

- 瀏覽器用 Firebase Authentication 取得 Google 登入憑證，透過記憶體訊息傳送到指定 Google bridge origin。
- Bridge 檢查來源 origin、window.top 與每次連線 nonce，回傳也比對來源視窗與 nonce。
- Apps Script 核對 aud、iss、sub、exp，再呼叫 Google accounts:lookup 進行線上驗證；只有自行解碼 JWT 不足以登入。
- 帳號必須未停用、Email 已驗證、有 Google provider，且憑證未早於帳號 validSince。
- Users 白名單初次依已驗證 Email 綁定 UID，此後以 UID 找帳號。
- 每次讀取與寫入重新驗證授權。家長快照只含綁定孩子的 Students、Attendance、Learning、Points。資源依班級及發布狀態過濾。
- 家長無寫入權。教員只能管理授權班級。帳號、設定、學期與匯入需要班負責。
- 照片讀取先確認照片 ID 存在且使用者可見；不接受前端提供 Drive fileId 指定下載。
- 所有管理 helper 以底線結尾，不能經 google.script.run 呼叫；僅 rpc 與 doGet 公開。

系統沒有全班家長積分排行榜。教員在授權班級中可看全班管理資料，即使同時綁定自己的孩子亦然。

## 防止重複登記與部分寫入

每一筆寫入具備 UUID 操作編號及伺服器計算的請求雜湊。同一人、同一內容重試會返回已有結果；不同內容重用編號會被拒絕。

Apps Script 使用 ScriptLock 將經由應用程式的寫入依序處理。點名、金句、積分及操作紀錄以同一主資料表的一次 Sheets batchUpdate 提交。批次中的驗證失敗不會只寫入其中一部分。直接由人手在 Sheets 編輯不受 ScriptLock 控制，避免與後台同時編輯主資料表。

正式瀏覽器送出前會將待確認操作的內容、編號及操作者 UID 暫存於 sessionStorage，不包含登入 token。結果不明時保留同一操作供重試；確定成功或確定被拒絕才清除。重新整理可續試；關閉分頁可能失去暫存，因此需先核對紀錄。其他帳號無法重試原操作者的操作。

Drive 檔案建立與 Sheets 記錄不在同一交易。照片寫入遇不明網路錯誤時保留檔案，避免刪掉已成功登記的照片；可能產生無索引檔案，由管理者人工核對。移除照片會隱藏索引並撤回相簿發布，Drive 上傳版本保留。

## 資料格式與維護

主資料表包含 Settings、Terms、Students、Users、Guardians、Sessions、Attendance、Points、Learning、Announcements、Events、Albums、Photos、Audit，完整欄位定義位於 src/domain.js。Courses 放在另一份課表試算表。

主資料表使用 stringValue 寫文字，避免使用者輸入被當成公式；CSV 匯出也處理公式開頭與雙引號。頁面以 React 文字節點顯示內容，不注入 HTML。外部連結只允許 HTTPS。

建議透過後台修改主資料。不要刪除 Audit 去節省空間，它同時用於重試去重；不要修改固定 ID 或既有 Points 金額。資料量增加到每次全表讀取過慢時，應評估索引、分年度資料表或獨立資料服務。

## 備份與使用限制

每日 JSON 備份包含個人資料及 UID，屬私人資料；只存放限制存取的資料夾。自動保留約 30 天，照片檔案本身不在 JSON 備份內。須另確認照片資料夾與攝影原始檔的保存方式。

本版適合小型班級與精選照片。每次取得快照會讀取資料表；Google 配額與延遲可能影響多人同時操作。正式啟用前需用真實 Google 部署及不同家長帳號驗收，也需測試使用者實際手機的登入與 iframe 相容性。程式與模擬測試不能取代部署驗收。

瀏覽器自動測試會攔截 config.js 並載入虛構示範模式，即使網站設定已切換 Google 也不會將正式個資寫入測試報告。另有 Google 設定缺漏時拒絕載入資料的測試。
