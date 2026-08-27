const responseBehaviorPattern =
  /(?:猫娘|语气|口吻|回复风格|回答风格|表达风格|措辞|称呼|persona|catgirl|tone|voice|response style|writing style|respond as|reply as|act as|address me|call me)/i;

export function isResponseBehaviorMemory(content: string): boolean {
  return responseBehaviorPattern.test(content.normalize("NFKC"));
}
