# Student document artifacts

Students can ask their active coding agent to create an editable Word document, a PDF, or both.

Choose **Student** during onboarding. In a thread, select **Document** in the composer toolbar or
run **Create document artifact** from the command palette. Add a title, choose a template and output
format, then describe the required content. Kairo adds a detailed request to the composer so it can
be reviewed before sending.

The agent writes generated files to the project's `artifacts` folder. Its final response links each
file. PDF links open in the browser preview. Word document links download the `.docx` file. These
links also work when the environment is reached over a local network, relay, or tunnel.

Mobile clients can type `/document` in an existing thread. This inserts an editable request for a
Word document and PDF.

Document quality depends on the selected provider and the document tools available in its runtime.
Kairo asks the agent to render and inspect each export before it finishes.
