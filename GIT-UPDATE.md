# Git / GitHub 后续开发流程

仓库：[JJHenry114/naiwa-kitchen](https://github.com/JJHenry114/naiwa-kitchen)。主分支为 `main`。

## 开始一次更新

在 `naiwa-kitchen` 工程目录打开终端，先检查是否有未保存的改动：

```sh
git status
git remote -v
```

在工作区干净时，同步主分支并创建开发分支：

```sh
git switch main
git pull --ff-only origin main
git switch -c feature/next-update
```

分支名可以换成此次改动的简短名称。如果已有未提交的工作，先提交或另行保留，再切换分支。

## 检查并提交

完成修改后，更新相应文档并运行测试：

```sh
npm test
git diff --check
git diff --stat
git diff
```

选择此次需要提交的文件加入暂存区，例如：

```sh
git add dist README.md CHANGELOG.md tests
git diff --cached --stat
git diff --cached
git commit -m "feat: describe your update"
git push -u origin feature/next-update
```

请按实际改动调整 `git add` 后的路径。提交信息应说明这次修改的用途。

## 合并与继续更新

推送后，在 GitHub 创建 Pull Request，查看差异和测试结果，再合并到 `main`。回到本地时运行：

```sh
git switch main
git pull --ff-only origin main
```

同一分支后续推送可直接使用 `git push`。若推送提示远端有新提交，先获取并检查差异，不要直接强制覆盖。

## 哪些内容需要提交

- 游戏代码与运行素材：`dist/`。
- 说明、测试、开发脚本与启动器。
- 文档中需要的截图：`docs/images/`。

测试存档 `.sites-runtime/`、临时 `QA-*.png` 截图、打包文件、日志和本地环境文件由 `.gitignore` 排除。

`.openai/hosting.json` 是原有开发工具的站点关联信息，包含项目标识，不是游戏运行依赖或 GitHub 自动部署配置。

推送代码不会自动更新原先的在线试玩站点。部署需要另行安排，也不会随代码同步浏览器里的个人游戏进度。
