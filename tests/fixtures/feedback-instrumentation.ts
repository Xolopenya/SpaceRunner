/** Only additive, labelled observation hooks are removed. The historical hash
 * still pins every original executable line (including the damage guard/order). */
export function withoutFeedbackInstrumentation(source: string): string {
  return source.replaceAll('\r\n', '\n').replace(/^[ \t]*\/\/ FEEDBACK-001A instrumentation begin\n[\s\S]*?^[ \t]*\/\/ FEEDBACK-001A instrumentation end\n/gm, '');
}

/** Remove only the explicitly additive, separately tested menu transition.
 * The historical hash still protects every original flight/score/collision line. */
export function withoutResultsNavigation(source: string): string {
  return source.replaceAll('\r\n', '\n').replace(/\n  \/\/ FEEDBACK-001D-C menu navigation begin\n[\s\S]*?  \/\/ FEEDBACK-001D-C menu navigation end\n/g, '');
}
