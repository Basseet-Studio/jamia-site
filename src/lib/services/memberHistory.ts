/**
 * Member-change history (per family).
 *
 * Lives in its own module per the spec, but is implemented as a thin
 * re-export of `subscribeMemberHistory` from the families service so the
 * implementation stays in one place.
 *
 * Hierarchy: household -> family -> members. History is stored under each
 * family at `households/{hhId}/families/{familyId}/memberHistory/{historyId}`.
 */
export { subscribeMemberHistory } from "@/lib/services/families";
