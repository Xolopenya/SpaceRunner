/** Only additive, labelled observation hooks are removed. The historical hash
 * still pins every original executable line (including the damage guard/order). */
export function withoutFeedbackInstrumentation(source: string): string {
  return source.replaceAll('\r\n', '\n').replace(/^[ \t]*\/\/ FEEDBACK-001A instrumentation begin\n[\s\S]*?^[ \t]*\/\/ FEEDBACK-001A instrumentation end\n/gm, '');
}
