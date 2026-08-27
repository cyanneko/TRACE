import { describe, expect, it } from "vitest";

import { hasExplicitGlobalMemoryInstruction } from "./globalMemoryInstruction.js";

describe("hasExplicitGlobalMemoryInstruction", () => {
  it.each([
    "请把我喜欢简短跟进添加到 Global Memory。",
    "让他加全局记忆：我默认使用北京时间。",
    "往全局记忆里加入：我习惯会前收到材料。",
    "Save my preference for short summaries to global memory.",
    "Remove the old timezone rule from Global Memory.",
  ])("recognizes a direct memory command: %s", (note) => {
    expect(hasExplicitGlobalMemoryInstruction(note)).toBe(true);
  });

  it.each([
    "Global Memory 现在包含什么？",
    "Maya asked me to remember her new role.",
    "Please add Maya to the meeting.",
    "Do not add this to Global Memory.",
    "不要把这段临时信息加入全局记忆。",
  ])("does not turn ordinary context into a global command: %s", (note) => {
    expect(hasExplicitGlobalMemoryInstruction(note)).toBe(false);
  });
});
