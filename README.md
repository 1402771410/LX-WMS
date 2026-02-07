# LX-WMS 离线桌面仓库管理系统

LX-WMS 是一套支持完全离线运行的桌面级仓库管理系统，使用 Ant Design 构建 UI，基于 SQLite 存储数据，并支持 GitHub Releases 在线更新。

## 关键特性

- 完全离线可用（除更新检查外）
- 首次启动强制离线创建管理员账号，初始化后关闭注册入口
- Windows .exe 安装器，默认安装路径为 `C:\LX-WMS` 且可自定义盘符
- GitHub Releases 自动更新检测

## 目录结构

```
electron/           Electron 主进程与本地数据库逻辑
electron/migrations SQLite 迁移脚本
src/                前端 UI
build/              安装器图标与构建资源
```

## 开发环境

1. 安装依赖（已内置 `.npmrc` 使用国内镜像）：

```bash
npm install
```

2. 启动桌面开发模式：

```bash
npm run dev
```

## 构建与打包

```bash
npm run dist
```

生成的 Windows 安装包输出在 `release/` 目录，默认安装目录为 `C:\LX-WMS`。

## 自动更新

- 更新源：GitHub Releases
- 请在发布时创建版本号 Tag，并上传安装包
- 更新逻辑由 `electron-updater` 驱动
- 若 GitHub 在国内访问不稳定，可增加代理或镜像，但版本源仍以 GitHub 为准

## GitHub 配置说明

请在 `package.json` 中配置正确的仓库地址：

- `repository.url`
- `build.publish.owner`
- `build.publish.repo`

## 安全说明

- 密码仅保存为强哈希（不可逆）
- 所有数据库操作均在本地完成
- 审计日志记录关键操作
