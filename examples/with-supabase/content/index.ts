// Re-exports for all 282 content modules.
//
// All UI-facing copy lives in this directory, one locale object per file, so
// the app never hardcodes user-facing strings. Import from "@/content" or the
// individual module. English (en-GB) is the only locale shipped in v1;
// everything is keyed by locale to make future i18n a drop-in.

// Each module exports a named locale const (e.g. `routing`, `landing`) plus its
// interfaces and any verbatim string constants. `export *` re-exports all of
// them, so both `import { landing } from "@/content"` and
// `import { landing } from "@/content/landing"` work.
export * from "./disclaimers";
export * from "./routing";
export * from "./tripwire";
export * from "./witness";
export * from "./contracts";
export * from "./summaries";
export * from "./deal-lifecycle";
export * from "./landing";
