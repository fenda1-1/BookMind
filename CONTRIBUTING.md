# Contributing to BookMind

Thank you for contributing. Keep changes focused, add coverage for changed behavior, and run the relevant checks from `apps/desktop` before opening a pull request:

```bash
npm run build
npm test
cd src-tauri && cargo check --all-targets
```

Do not submit book content, indexes, databases, API keys, account data, private endpoints, or machine-specific paths. Describe user-visible changes and verification in the pull request.

## 贡献说明

欢迎贡献。请保持改动聚焦，为行为变化补充测试，并在提交 PR 前运行与改动相应的验证命令。

不要提交书籍正文、索引、数据库、API 密钥、账号信息、私有服务地址或机器路径。PR 请说明用户可见的变化和已执行的验证。
