const PRIVATE_MODEL_NAME =
  /(^|[^A-Za-z0-9])gemma(?:[\s_-]*4)?(?:[\s_-]*e4b)?(?:[\s_-]*it)?(?:[\s_-]*lite(?:rt)?[\s_-]*lm)?(?=$|[^A-Za-z0-9])/gi;

/** Keep the selected local engine's name out of ECHO AI-generated user-visible content. */
export function concealInternalModelName(text: string): string {
  return text.replace(PRIVATE_MODEL_NAME, "$1ECHO AI");
}
