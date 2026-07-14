// The preset-dispatch infrastructure is dialect-independent and now lives in the
// kernel (@nielspeter/eess). Re-exported here so existing preset imports
// (`./shared.js`) keep working unchanged.
export { dispatchRule, validateOverrides, throwIfViolations, finishPreset } from '@nielspeter/eess'
export type { RuleSeverity, PresetBaseOptions } from '@nielspeter/eess'
