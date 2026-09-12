/**
 * Quick Prompts —— 输入框上方常驻一行「常用提示词」，悬停高亮、点一下直接发送。
 *
 * 为什么这么写：
 * - 位置只能用 setWidget(key, ..., { placement: "aboveEditor" })：这是 pi 里唯一能稳定贴在
 *   编辑器上方的挂载点。用自定义组件而不是 string[]，因为点击命中要按列区间判断。
 * - 提示词存在 ~/.pi/agent/quick-prompts.json，改词不用改代码；文件不存在时写一份示例。
 * - 只支持鼠标点击（不注册快捷键）：因此只在 `--tui-mode fullscreen` 下可用。
 * - 组件自己实现 handleMouse，不用 MouseRegion 包一层：MouseRegion 只在子组件没有鼠标处理时才有意义。
 */
import assert from "node:assert";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Component, TuiMouseEvent, TuiMouseEventResult } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
// Theme 由 pi-coding-agent 导出（pi-tui 只导出 EditorTheme 等子类型，没有 Theme 本体）
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

interface QuickPrompt {
	/** 按钮上显示的文字，建议 2-6 个字，太长会把整行挤掉。 */
	label: string;
	/** 点击后作为用户消息发出去的内容。 */
	text: string;
}

/** 一个已渲染按钮占据的列区间（零基，右开），点击时按 x 反查。 */
interface Chip {
	start: number;
	end: number;
	index: number;
}

/** 上限 9 条：一行能放下的数量上限，再多也挤不下。 */
const MAX_PROMPTS = 9;

const CONFIG_PATH = join(getAgentDir(), "quick-prompts.json");

/** 首次运行的示例，用户直接改这个文件即可；不做配置界面，改 JSON 比改代码快。 */
const DEFAULT_PROMPTS: QuickPrompt[] = [
	{ label: "继续", text: "继续" },
	{ label: "总结", text: "总结当前进度、已完成的改动和下一步" },
	{ label: "查bug", text: "review 你刚才的改动，找 bug、边界问题和回归风险" },
];

function loadPrompts(): QuickPrompt[] {
	if (!existsSync(CONFIG_PATH)) {
		writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_PROMPTS, null, 2), "utf8");
		return DEFAULT_PROMPTS.slice(0, MAX_PROMPTS);
	}
	try {
		const parsed: unknown = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((p): p is QuickPrompt => {
				const o = p as Partial<QuickPrompt> | null;
				return !!o && typeof o.label === "string" && typeof o.text === "string";
			})
			.slice(0, MAX_PROMPTS);
	} catch {
		// 配置写坏了就当成空，静默降级：不能因为一个提示词文件让整个会话起不来
		return [];
	}
}

/** 命中判定抽成纯函数，便于自检。间隔处（返回 undefined）不可点。 */
function hitTest(chips: Chip[], x: number): number | undefined {
	return chips.find((c) => x >= c.start && x < c.end)?.index;
}

/** 横排按钮行。一行放不下时丢弃尾部整块按钮，而不是截半个（截半个点了会误发）。 */
class PromptBar implements Component {
	private chips: Chip[] = [];
	/** 当前 hover 的按钮下标，-1 表示无。鼠标移出整块 widget 时收不到事件，会停留在最后一次的 hover 上。 */
	private hoverIndex = -1;

	constructor(
		private readonly prompts: QuickPrompt[],
		private readonly theme: Theme,
		private readonly onPick: (index: number) => void,
	) {}

	render(width: number): string[] {
		const chips: Chip[] = [];
		const line: string[] = [];
		let col = 0;

		for (let i = 0; i < this.prompts.length; i++) {
			const prompt = this.prompts[i];
			if (!prompt) continue;
			const chipText = ` ${prompt.label} `;
			const chipWidth = visibleWidth(chipText);
			const lead = i === 0 ? 0 : 1;
			if (col + lead + chipWidth > width) break;
			col += lead;
			chips.push({ start: col, end: col + chipWidth, index: i });
			// 按钮样式：平时淡背景，hover 反白 —— 反色块比改文字更接近“按钮”
			const style = i === this.hoverIndex ? this.theme.inverse(this.theme.bold(chipText)) : this.theme.bg("selectedBg", this.theme.fg("accent", chipText));
			line.push((i === 0 ? "" : " ") + style);
			col += chipWidth;
		}

		this.chips = chips;
		return [truncateToWidth(line.join(""), width)];
	}

	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		const index = hitTest(this.chips, event.x);

		if (event.type === "move") {
			const next = index ?? -1;
			if (next === this.hoverIndex) return undefined;
			this.hoverIndex = next;
			return { handled: true, render: true };
		}

		if (event.button !== "left") return undefined;

		// press 必须被吞掉：pi 只在 press 被组件处理时才记下鼠标目标，release 同点时才会补发 click
		if (event.type === "press") return index === undefined ? undefined : { handled: true };

		if (event.type === "click") {
			if (index === undefined) return undefined;
			this.onPick(index);
			return { handled: true };
		}

		return undefined;
	}

	/** 渲染没有缓存，主题变化时重新 render 就够。 */
	invalidate(): void {}
}

export default function quickPrompts(pi: ExtensionAPI) {
	const prompts = loadPrompts();
	let ctx: ExtensionContext | undefined;

	const pick = (index: number) => {
		const prompt = prompts[index];
		if (!prompt) return;
		try {
			pi.sendUserMessage(prompt.text);
		} catch (err) {
			// 正在 streaming 时 sendUserMessage 必须声明投递方式，排队到本轮工具跑完
			try {
				pi.sendUserMessage(prompt.text, { deliverAs: "followUp" });
			} catch {
				ctx?.ui.notify(`发送失败：${err instanceof Error ? err.message : String(err)}`, "error");
			}
		}
	};

	pi.on("session_start", (_event, context) => {
		ctx = context;
		if (!context.hasUI) return;
		if (prompts.length === 0) return;
		context.ui.setWidget("quick-prompts", (_tui, theme) => new PromptBar(prompts, theme, pick), {
			placement: "aboveEditor",
		});
	});
}

// 自检：npm run check（Node ≥ 24，依赖 import.meta.main 与原生 TS 类型擦除）
if ((import.meta as { main?: boolean }).main) {
	const chips: Chip[] = [
		{ start: 0, end: 4, index: 0 },
		{ start: 6, end: 11, index: 1 },
	];
	assert.equal(hitTest(chips, 0), 0);
	assert.equal(hitTest(chips, 3), 0);
	assert.equal(hitTest(chips, 4), undefined, "按钮之间的间隙不应命中");
	assert.equal(hitTest(chips, 6), 1);
	assert.equal(hitTest(chips, 10), 1);
	assert.equal(hitTest(chips, 11), undefined);
	assert.equal(hitTest(chips, -1), undefined);

	// 鼠标协议：pi 只把 release 补发成 click，前提是同一目标处理了 press
	const stubTheme = {
		fg: (_c: string, t: string) => t,
		bg: (_c: string, t: string) => t,
		bold: (t: string) => t,
		inverse: (t: string) => t,
	} as unknown as Theme;
	const picks: number[] = [];
	const bar = new PromptBar(
		[
			{ label: "a", text: "A" },
			{ label: "b", text: "B" },
		],
		stubTheme,
		(i) => picks.push(i),
	);
	const mouse = (type: string, x: number) =>
		({
			type,
			button: type === "move" ? "none" : "left",
			x,
			y: 0,
			screenX: 0,
			screenY: 0,
			width: 80,
			height: 1,
			shift: false,
			alt: false,
			ctrl: false,
		}) as TuiMouseEvent;

	bar.render(80);
	assert.deepEqual(bar.handleMouse(mouse("press", 1)), { handled: true }, "press 必须被处理，否则 click 不会派发");
	assert.equal(bar.handleMouse(mouse("press", 20)), undefined, "空白处不拦鼠标");
	assert.deepEqual(bar.handleMouse(mouse("click", 1)), { handled: true });
	assert.deepEqual(picks, [0]);
	assert.deepEqual(bar.handleMouse(mouse("move", 1)), { handled: true, render: true }, "hover 进入按钮要重绘");
	assert.equal(bar.handleMouse(mouse("move", 1)), undefined, "hover 未变化不重绘");
	assert.deepEqual(bar.handleMouse(mouse("move", 6)), { handled: true, render: true });
	assert.deepEqual(bar.handleMouse(mouse("move", 30)), { handled: true, render: true }, "移出按钮要清掉 hover");
	// 放不下的按钮既不渲染也不可点
	bar.render(6);
	assert.equal(bar.handleMouse(mouse("click", 5)), undefined);
	console.log("quick-prompts self-check ok");
}
