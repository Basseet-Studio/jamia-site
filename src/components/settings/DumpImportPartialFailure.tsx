"use client";
/**
 * Blocking screen after a web dump import fails mid-chunk.
 * Not a toast. Volunteer must re-import the named backup file.
 */

const PARTIAL_IMPORT_MESSAGE_TEMPLATE =
  "The import did not finish. Your data may be a mix of old and new. Re-import the backup file that was downloaded before this started ({backupFileName}) to restore your previous data.";

export function DumpImportPartialFailure({
  backupFileName,
}: {
  backupFileName: string;
}) {
  const message = PARTIAL_IMPORT_MESSAGE_TEMPLATE.replace(
    "{backupFileName}",
    backupFileName,
  );
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive bg-destructive/5 p-6 space-y-3"
    >
      <h2 className="text-xl font-semibold">
        Import did not finish
        {/* TODO: localise this later */}
      </h2>
      <p className="text-sm leading-relaxed">{message}</p>
      {/* TODO: localise this later */}
      <p className="font-mono text-sm break-all">{backupFileName}</p>
    </div>
  );
}
