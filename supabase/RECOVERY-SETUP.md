# 備援信箱取回帳號：部署前檢查

2026-10-14：使用者明確要求略過真人端對端測試直接上線。以下未實測項目保留作為後續驗證清單，不得宣稱已全部通過。

## Secrets（僅在 Supabase 後台輸入）

- FORUM_SMTP_USER：寄件 Gmail，與 Auth SMTP 的帳號相同。
- FORUM_SMTP_PASS：Google 應用程式密碼。Auth SMTP 設定不會自動傳給 Edge Function。
- FORUM_RECOVERY_HMAC_KEY：密碼管理器產生的至少 32 字元隨機秘密，不可使用論壇密碼或 SMTP 密碼。輪替此值會使未使用驗證碼失效。
- FORUM_BACKUP_ENABLED：先保持 false，實際 SMTP、取回、撤銷登入測試全部通過才設 true。

不要將 Secrets 放入 Git、前端、截圖或聊天。SMTP 固定 Gmail 的 TLS 465；驗證憑證，不允許降級。

## 行為

綁定或更換備援信箱需有效個人登入，以及原 Gmail 和新信箱兩組驗證碼。不更改 Auth 主信箱，不建立第二會員。
取回需輸入主 Gmail 和已綁定備援信箱，使用一次性驗證碼設定新密碼，不自動登入。
8 位驗證碼 10 分鐘失效、每次最多 5 次嘗試；每會員或收件地址 60 秒寄送間隔、每小時 5 次。資料庫只存 HMAC。
錯誤嘗試使用返回值而非拋出 SQL 例外，避免交易回滾計數。驗證成功與作廢同帳號其他驗證碼在單一交易內進行。
取回先封鎖論壇個人操作，再呼叫 Auth 管理 API 更新密碼；失敗維持封鎖，需重新申請取回。成功後只接受在撤銷時間之後新建的 Auth session，舊 refresh token 亦不能繞過論壇檢查。
同校識別不受個別帳號失敗影響。公開資料表不提供 anon/authenticated 存取權限。通知信失敗不會重做密碼修改。

## 上線門檻

1. 套用 001、002 migration，確認既有 site_members 和私人題庫 RLS 未更動。
2. 001 以驗證過的 Auth 身分對應 canonical Gmail 會員；Google／密碼可共用會員，Google 真實 OAuth 與別名行為仍須端對端驗證。
3. 部署 forum-api 並檢查 runtime 對 npm:nodemailer@10.1.1 和 TLS 465 的相容性。
4. 用獨立測試帳號實測雙信箱綁定、錯碼、過期、重放、更換、重設密碼、舊 session 拒絕、新登入成功、寄信失敗。
5. 現有基本測試使用 PGlite／mock，不等於 Gmail 寄信、Google OAuth 或雲端端對端驗證。
6. 建立清理排程：刪除超過 7 日的 challenge 資料，保留至少一小時資料以維持配額；確認 Supabase Auth 自身註冊／寄信限流，評估 CAPTCHA 以降低匿名垃圾請求。

備援信箱與原信箱具有帳號控制權，UI 已提示用途。Google 真實登入、SMTP 實際投遞及真人帳號取回尚未驗證。程式有本地測試及部署後權限檢查，不代表零風險。
