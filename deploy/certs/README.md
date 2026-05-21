# 微信支付证书目录

请将以下证书文件放置在此目录中：

- `apiclient_key.pem` — 商户私钥（从微信商户后台下载）
- `wechatpay_platform.pem` — 微信支付平台证书（通过微信支付API自动下载或手动导出）

⚠️ 不要将真实证书提交到 Git 仓库。`.pem` 文件已在 `.gitignore` 中忽略。
