/** Dump size ceiling — keep in lockstep with jamia-native/lib/domain/dump_limits.dart */
export const DUMP_MAX_BYTES = 209715200;
export const DUMP_MAX_ATTACHMENTS = 100;

export const DUMP_OVER_CEILING_MESSAGE =
  "This dump is too large (over 200 MiB or more than 100 attachments). Split or remove scans and try again.";
