const globalMemoryScope = /(?:global\s*memory|全局\s*(?:memory|记忆))/iu;
const memoryCommand =
  /(?:加|增加|新增|新建|加入|写入|存入|存到|放入|放到|保存|记录|记到|记入|记住|更新|修改|改成|删除|移除|清除|忘记|\badd\b|\bappend\b|\bcreate\b|\bsave\b|\bstore\b|\bwrite\b|\bput\b|\bremember\b|\bupdate\b|\bchange\b|\bedit\b|\bdelete\b|\bremove\b|\bforget\b)/iu;
const negatedMemoryWrite =
  /(?:不要|别|无需|不必|不需要).{0,30}(?:global\s*memory|全局\s*(?:memory|记忆))|(?:\bdo\s+not\b|\bdon't\b|\bnever\b).{0,50}\bglobal\s*memory\b/iu;

export function hasExplicitGlobalMemoryInstruction(note: string): boolean {
  const normalized = note.normalize("NFKC").trim();
  if (!normalized || !globalMemoryScope.test(normalized) || !memoryCommand.test(normalized)) {
    return false;
  }
  return !negatedMemoryWrite.test(normalized);
}
