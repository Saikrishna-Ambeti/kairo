import {
  buildStudentArtifactPrompt,
  STUDENT_ARTIFACT_FORMAT_LABELS,
  STUDENT_ARTIFACT_FORMATS,
  STUDENT_ARTIFACT_TEMPLATE_LABELS,
  STUDENT_ARTIFACT_TEMPLATES,
  type StudentArtifactFormat,
  type StudentArtifactTemplate,
} from "@kairo/shared/studentArtifacts";
import { FileTextIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";

interface StudentArtifactGeneratorDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAddPrompt: (prompt: string) => void;
}

export function StudentArtifactGeneratorDialog(props: StudentArtifactGeneratorDialogProps) {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [template, setTemplate] = useState<StudentArtifactTemplate>("assignment");
  const [format, setFormat] = useState<StudentArtifactFormat>("both");
  const canAdd = title.trim().length > 0 && instructions.trim().length > 0;

  const addPrompt = () => {
    if (!canAdd) return;
    props.onAddPrompt(buildStudentArtifactPrompt({ title, instructions, template, format }));
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup className="max-w-xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="size-5 text-primary" />
            Create document artifact
          </DialogTitle>
          <DialogDescription>
            Build an editable document, a PDF, or both inside this project.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4" scrollFade={false}>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Title</span>
            <Input
              nativeInput
              value={title}
              placeholder="Cell biology study guide"
              autoFocus
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Template</span>
              <Select value={template} onValueChange={(value) => value && setTemplate(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {STUDENT_ARTIFACT_TEMPLATES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {STUDENT_ARTIFACT_TEMPLATE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </label>

            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Output</span>
              <Select value={format} onValueChange={(value) => value && setFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {STUDENT_ARTIFACT_FORMATS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {STUDENT_ARTIFACT_FORMAT_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </label>
          </div>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">What should it contain?</span>
            <Textarea
              value={instructions}
              placeholder="Cover mitosis and meiosis, add a comparison table, then include ten practice questions."
              onChange={(event) => setInstructions(event.currentTarget.value)}
            />
          </label>

          <p className="text-muted-foreground text-xs leading-5">
            Agent creates files in the project&apos;s artifacts folder and checks rendered output.
          </p>
        </DialogPanel>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canAdd} onClick={addPrompt}>
            Add request
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
