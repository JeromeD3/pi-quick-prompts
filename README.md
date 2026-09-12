# pi-quick-prompts

给 [pi coding agent](https://pi.dev) 的输入框上方加一行常驻「常用提示词」按钮：**悬停高亮，点一下就发出去**。

![demo](https://img.shields.io/badge/pi-package-blue)

```
        ┃                 ┃
        ┃  继续  总结  查bug  ┃   ← 悬停反白，点击直接发送
        ┃                 ┃
  ╭─────────────────────────────────────────╮
  │ > 输入消息…                              │
  ╰─────────────────────────────────────────╯
```

## 安装

```bash
pi install git:github.com/JeromeD3/pi-quick-prompts
```

装完后 `/reload`。（想钉版本：`pi install git:github.com/JeromeD3/pi-quick-prompts@v0.1.0`）

## 用法

| 操作 | 效果 |
| --- | --- |
| 鼠标点击按钮 | 直接把该提示词作为用户消息发送 |
| 鼠标悬停 | 按钮底色变成主题 accent 色（普通态是淡灰底） |

只支持鼠标（不注册快捷键）。agent 正在输出时点击，消息会以 `deliverAs: "followUp"` 排队到本轮结束，不会丢。

## 配置

提示词存在 `~/.pi/agent/quick-prompts.json`，首次运行自动生成示例，改完 `/reload` 生效。

```json
[
  { "label": "继续", "text": "继续" },
  { "label": "总结", "text": "总结当前进度、已完成的改动和下一步" }
]
```

| 字段 | 说明 |
| --- | --- |
| `label` | 按钮上显示的文字，建议 2–6 个字 |
| `text` | 点击后实际发送的完整内容 |

其它行为：

- 最多 9 条（一行也放不下更多）。
- 一行放不下时，尾部放不下的按钮**整块隐藏**（不截半个，避免点歪误发）。
- 文件写坏时静默降级为空，不会拖垮启动。

## 已知限制

- **必须使用 `--tui-mode fullscreen`。** regular 模式下终端不把鼠标事件交给 pi，插件无法使用。
  切换：`/settings` → `tuiMode: fullscreen`，或启动 `pi --tui-mode fullscreen`。
- **tmux / zellij / screen 里没有悬停高亮**：这些环境 pi 只开启按键移动上报（`1002`）而非全部移动（`1003`），点击仍然正常。
- 鼠标从按钮直接移到编辑器区域时收不到「离开」事件，高亮可能残留到下一次移动。

## 开发

```bash
npm install                # 拉取 peer 依赖用于自检
npm run check              # 断言命中判定、press/click 协议、hover 状态机
```

自检不依赖任何测试框架，就是文件底部的 `assert` 段（`import.meta.main` 保护，被 pi 加载时不会执行），覆盖命中判定、press/click 协议、hover 状态机。

需要 Node ≥ 24（用 `import.meta.main` 与原生 TypeScript 类型擦除）。

## License

MIT
