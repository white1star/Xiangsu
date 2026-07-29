# 唐山像素智能｜竞品项目情报工作台

只收录 XRT 矿石智能分选设备和煤炭智能干选设备的**招标、候选人和中标**公开情报；不录入产品宣传、展会或泛技术文章。

## 公网发布

推送到 `main` 后，GitHub Pages 工作流自动构建并发布工作台。首次启用时，在仓库 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。公开地址为：

`https://white1star.github.io/Xiangsu/`

## 每周自动更新

`每周竞品情报更新` 在每周一 09:10（Asia/Shanghai）执行，也可在 Actions 页面手动点击 **Run workflow**。

它只抓取 `config/public-sources.json` 中标为 `anonymous` 的公开来源，并把本次运行报告写到 `public/data/latest-run.json`。只有全部 `required: true` 的来源成功检查，才允许更新 `src/data/intelligence.json` 并自动提交。

## 防漏抓规则

- 每个必查公开平台都必须有成功检查记录；少一个即失败，不发布“已更新”。
- 新记录必须有标题、原始链接、来源、发布日期和招投标状态；缺任何一项只进失败报告，不进台账。
- 已存在的原始链接不会重复写入。
- 每周报告记录检查时间、HTTP 状态、发现数量、新增数量、拒绝数量和失败来源。

## 需要登录的平台

`config/public-sources.json` 中 `access: registered` 的平台不会被绕过。后续获得公司账号后，可另建授权采集流程。
