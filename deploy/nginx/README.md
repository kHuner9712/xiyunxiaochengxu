## DNS 配置

部署前请确认以下 DNS 记录已配置：

| 域名 | 类型 | 值 | 说明 |
|------|------|------|------|
| api.yunxixiaochengxu.com.cn | A | 62.234.69.19 | API 服务 |
| admin.yunxixiaochengxu.com.cn | A | 62.234.69.19 | 管理后台 |

验证命令：
```bash
dig api.yunxixiaochengxu.com.cn
dig admin.yunxixiaochengxu.com.cn
```

或：
```bash
nslookup api.yunxixiaochengxu.com.cn
nslookup admin.yunxixiaochengxu.com.cn
```
