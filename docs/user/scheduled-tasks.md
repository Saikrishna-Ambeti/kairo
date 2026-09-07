# Scheduled tasks for students

Scheduled tasks run agent instructions on the Kairo environment that owns the selected project. Open the page from the clock button above Search in the main sidebar, or search for “scheduled tasks” in the command palette.

Kairo includes starters for assignment check-ins, weekly revision planning, lecture-note cleanup, and end-of-week study resets. You can also create a routine with a manual, one-time, hourly, daily, weekday, weekly, cron, webhook, calendar, email, or GitHub trigger.

Use the three tabs to switch between Student starters, Your routines, and Review inbox. The inbox tab shows how many runs need review.

Choose New routine or a student starter to open setup in a popup. Enter one detail at a time, use Next to continue, and use Back to change an earlier answer without losing your work. The final step shows the routine's settings before you save. Editing a routine uses the same popup, with its current values filled in. Cancel closes setup without saving.

Choose how Kairo handles runs missed while the environment was asleep and whether a new run should queue or skip when an earlier run is active. Time-based schedules use the routine’s IANA timezone and account for daylight-saving changes.

Each run opens a normal chat in approval-required mode. Permission requests appear in that chat’s composer. Persistent grants are listed under the routine and can be revoked there. Completed and skipped runs appear in the review inbox with their receipts and skip reasons.

Routines are stored on the environment and use revision checks, so an older browser or device cannot silently overwrite a newer edit. You can create, edit, duplicate, pause, resume, run, and delete routines. The composer also accepts direct commands such as “pause my revision routine.”

Mobile shows an explicit unsupported state for schedule management. Run chats still appear in the normal mobile thread list.
