# Message composer

Messages can contain up to 120,000 characters. If a draft is longer, Kairo keeps it in the
composer and shows how many characters need to be removed. Shorten the draft or split it into
multiple messages, then send again in the same thread.

On desktop, press `Cmd+Enter` on macOS or `Ctrl+Enter` on Windows and Linux from a new thread to
start it in the background. Kairo opens another new thread and shows an **Open** action for the
thread that started. The new thread keeps the selected workspace mode and base branch. If **New
worktree** is selected, each background thread creates its own worktree.

## Interaction modes

Use the interaction mode control to choose how the agent works in the current thread:

- **Build** works normally and can edit files or run commands.
- **Plan** explores the work and prepares a plan before editing. Use `/plan` or press `Shift+Tab`
  to enter it, and `/default` to return to Build.
- **Study** teaches through questions, hints, examples, and feedback instead of immediately doing
  the work. It follows an existing learning plan, teaches the current item in detail, and continues
  from the first incomplete item. When hosted memory is enabled for the provider, Study saves the
  plan and lesson progress to Supermemory so **continue** can resume the next task or planned day in
  another thread. It appears when the professional role selected during onboarding is **Student**.
  Use `/study` to enter it.

The selected mode belongs to the thread. Study Mode does not change the thread's permission mode.

## Deep Research

Open the three-dot menu in the composer and select **Deep Research**, or start a message with
`/research`. If the composer already has a request, selecting **Deep Research** starts it. From an
empty composer, the selection inserts `/research`; add the question or topic and send. Kairo asks
the agent to research in the background, check material claims against independent sources,
prefer primary sources, and include source links. New desktop threads start without taking over
the current view, so you can continue working while the research runs.
