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
| 鼠标悬停 | 按钮反白高亮 |
| 快捷键（默认 `Ctrl+1` … `Ctrl+9`） | 同上，键盘兜底；**可在配置里改成任意键** |

agent 正在输出时点击，消息会以 `deliverAs: "followUp"` 排队到本轮结束，不会丢。

## 配置

提示词和快捷键写在同一个文件：`~/.pi/agent/quick-prompts.json`。首次运行自动生成示例，改完 `/reload` 生效。

```json
[
  { "label": "继续", "text": "继续", "key": "ctrl+1" },
  { "label": "总结", "text": "总结当前进度、已完成的改动和下一步", "key": "alt+s" }
]
```

| 字段 | 说明 |
| --- | --- |
| `label` | 按钮上显示的文字，建议 2–6 个字 |
| `text` | 点击/按键后实际发送的内容（想临时加参数就自己打字，或用 `Ctrl+N` 前先写好） |
| `key` | 可选快捷键，不写则按顺序默认 `ctrl+1`、`ctrl+2`…… |

**快捷键格式**：与 pi 的 `keybindings.json` 一致 —— 修饰键 `ctrl` / `alt` / `shift` / `super` 可组合，主键可用字母、数字、`f1`–`f12`、方向键、`/` 等符号。例如 `ctrl+1`、`alt+r`、`ctrl+shift+p`、`alt+enter`。按钮上只显示主键（`alt+s` → `S`），数字键显示数字。

> 为什么不直接把键写进 `~/.pi/agent/keybindings.json`？那份配置只覆盖 pi 内置 action，扩展注册的快捷键不经过它，所以改键要改这里。

其它行为：

- 最多 9 条（一行也放不下更多）。
- 一行放不下时，尾部放不下的按钮**整块隐藏**（不截半个，避免点歪误发）。
- 快捷键重复时保留第一条，其余在控制台 warn。
- 键名写错只 warn，不影响按钮点击与启动。
- 文件写坏时静默降级为空，不会拖垮启动。

## 已知限制

- **鼠标（悬停/点击）只在 `--tui-mode fullscreen` 下生效。** regular 模式下终端不把鼠标事件交给 pi，此时用 `Ctrl+1..9`。
  切换：`/settings` → `tuiMode: fullscreen`，或启动 `pi --tui-mode fullscreen`。
- **tmux / zellij / screen 里没有悬停高亮**：这些环境 pi 只开启按键移动上报（`1002`）而非全部移动（`1003`），点击仍然正常。
- 鼠标从按钮直接移到编辑器区域时收不到「离开」事件，高亮可能残留到下一次移动。

## 开发

```bash
npm install                # 拉取 peer 依赖用于自检
npm run check              # 断言命中判定、press/click 协议、hover 状态机
```

自检不依赖任何测试框架，就是文件底部的 `assert` 段（`import.meta.main` 保护，被 pi 加载时不会执行）。

需要 Node ≥ 24（用 `import.meta.main` 与原生 TypeScript 类型擦除）。

## License

MIT
