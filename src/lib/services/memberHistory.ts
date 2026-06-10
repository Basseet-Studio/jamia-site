/**
 * Member-change history (US-1).
 *
 * Lives in its own module per the spec, but is implemented as a thin
 * re-export of `subscribeMemberHistory` from the households service so the
 * implementation stays in one place.
 */
export { subscribeMemberHistory } from "@/lib/services/households";
