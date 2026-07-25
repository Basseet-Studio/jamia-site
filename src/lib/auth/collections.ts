/**
 * Staff collection holds authorized app users (owner | admin | clerk).
 *
 * Named `staff` (not `admins`) because ad blockers commonly block network
 * requests whose URL path contains `/admins/` — which surfaces in DevTools as
 * `net::ERR_BLOCKED_BY_CLIENT` and breaks promote/list from Settings.
 */
export const STAFF_COLLECTION = "staff";

/** Legacy collection — kept for read/migrate until all docs live under `staff`. */
export const LEGACY_ADMINS_COLLECTION = "admins";
