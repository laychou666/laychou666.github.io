# Bingzhou Li · 个人学术主页

简洁的白色页面、灰绿色链接与清晰的学术内容。正文采用本地 Merriweather（16px），标题采用 Montserrat（姓名约 30px）。立体小助手 **ADAM** 基于 Klemen Kotar 主页的履带机器人实现，采用受 WALL·E 启发的双筒镜头、机械脖子与暖黄色方机身，并接入本站的页面互动。

网站使用原生 HTML、CSS 和 JavaScript，无构建步骤，也无需安装依赖。直接部署到 GitHub Pages。

## 本地预览

在仓库根目录运行：

```sh
python3 -m http.server 8000
```

打开 <http://localhost:8000>，按 `Ctrl+C` 停止服务。

## 更新与维护

- `index.html`：个人介绍、论文、经历、教育背景、精选荣誉、个人爱好及链接。
- `static/assets/overview/`：四篇论文的主图，`arc.png` 对应 AutoResearchClaw。
- `static/css/main.css`：字体、颜色、页面布局和移动端样式。
- `static/js/scripts.js`：导航与论文筛选。
- `static/js/companion.js`：ADAM 的安全通道、自主漫游、章节跟随、提示和暂停控制。
- `static/js/robot-model.js`：来自参考站的 Three.js 几何造型与动画；顶部 `COLORS` 控制配色。
- `static/js/robot-renderer.js`：灯光、相机、履带行驶、交互动作、拖动旋转与渲染生命周期。
- `static/assets/robot-rover.svg`：WebGL 不可用时的静态履带机器人。
- `static/js/vendor/`：固定版本 Three.js r180 与 MIT 许可证。
- `static/assets/fonts/`：自托管字体与各自的 SIL Open Font License。

内容更新以最新 CV 为准；论文区展示已发表信息或预印本信息，不显示在审会议。板块顺序为个人介绍、研究、经历、教育背景、精选荣誉和个人爱好。经历板块突出 cPilot 项目；教育背景只列学校、专业和时间，成绩、课程及完整履历留在 CV 中。

头像下方并排展示邮箱、CV 和 GitHub 的 SVG 图标，随后列出研究兴趣关键词，不重复列学校。邮箱图标使用 `mailto:choulay@tongji.edu.cn` 链接，并在悬停时显示 `choulay AT tongji.edu.cn`；页脚不显示邮箱。修改邮箱时，更新 `index.html` 中邮箱图标的链接、无障碍名称和悬停提示。三个图标均带有无障碍名称和悬停提示。论文区保留领域筛选，不显示论文数量或 summary；论文和代码使用带悬停提示的图标链接。主图在宽屏中位于论文信息左侧，窄屏中置于上方，按原比例显示，点击可在新标签页查看原图。

[当前 CV](https://drive.google.com/file/d/119vJFY17Kux2mTu0pGJrMMS_sbrUeibv/view?usp=drive_link)

## 发布

保留仓库现有 GitHub Pages 配置。提交并推送到发布分支后，Pages 自动发布静态文件，无需打包。`.nojekyll` 保证文件直接发布。

机器人基础结构与动画来自 [Klemen Kotar 的主页仓库](https://github.com/klemenkotar/klemenkotar.github.io)，具体来源为 [`js/robot.js`](https://github.com/klemenkotar/klemenkotar.github.io/blob/master/js/robot.js)，于 2026-10-12 获取。本站调整为受 WALL·E 启发的双筒镜头眼睛、细机械脖子、暖黄色方机身与灰色夹爪，保留履带行驶及眨眼、挥手、歪头等动作。渲染适配器将其接入已有漫游、阅读提示、暂停与键盘/拖动旋转交互。造型全部由几何体生成。

有侧栏的布局（宽度大于700px）中，ADAM会在正文左侧的空白通道行驶，点击导航和悬停论文时跑到旁边。较矮窗口会自动缩小机器人，为行驶预留空间；入场挥手结束后约3秒开始首次漫游，受其他互动阻挡时短暂等待再出发。手机保持在简介照片区，保留待机和点击回应。布局和交互随屏宽自动适配，无需手动切换电脑/手机版。

代码与静态后备图自托管，无远程模型或 CDN。WebGL 不可用时显示本地 SVG；离开屏幕、切到后台或暂停时停止动画，尊重系统减少动态效果设置。

原模板 MIT 授权保留在 `LICENSE`；字体授权保存在字体目录，Three.js 的 MIT 授权在 vendor 目录。
