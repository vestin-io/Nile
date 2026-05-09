import EmojiPicker, { Theme, type EmojiClickData } from "emoji-picker-react";
import { Workflow } from "lucide-react";
import { useEffect, useState } from "react";

import type { Translator } from "../shared/I18n";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Field } from "../ui/field";
import { Input } from "../ui/input";

type ProfileMetaEditorProps = {
  disabled: boolean;
  emoji: string;
  error?: string | null;
  name: string;
  t: Translator;
  onEmojiChange(emoji: string): void;
  onNameChange(name: string): void;
};

export function ProfileMetaEditor({
  disabled,
  emoji,
  error,
  name,
  t,
  onEmojiChange,
  onNameChange,
}: ProfileMetaEditorProps) {
  const [isEmojiDialogOpen, setIsEmojiDialogOpen] = useState(false);
  const [pickerTheme, setPickerTheme] = useState<Theme>(() => readPickerTheme());

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setPickerTheme(readPickerTheme());
    });

    observer.observe(root, {
      attributeFilter: ["class", "data-theme", "style"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Field label={t("profiles.nameLabel")}>
        <div className="flex items-stretch">
          <Button
            className="h-11 rounded-r-none border-r-0 px-4 text-2xl"
            disabled={disabled}
            variant="outline"
            onClick={() => setIsEmojiDialogOpen(true)}
          >
            {emoji || <Workflow className="h-5 w-5 text-muted-foreground" />}
          </Button>
          <Input
            className="h-11 rounded-l-none"
            value={name}
            disabled={disabled}
            placeholder={t("profiles.namePlaceholder")}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>
        {error ? (
          <div className="pt-2 text-sm text-destructive">{error}</div>
        ) : null}
      </Field>

      <Dialog open={isEmojiDialogOpen} onOpenChange={setIsEmojiDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-0 bg-transparent p-0 shadow-none">
          <DialogHeader>
            <DialogTitle className="sr-only">{t("profiles.emojiPickerTitle")}</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            <EmojiPicker
              height={420}
              previewConfig={{ showPreview: false }}
              theme={pickerTheme}
              width="100%"
              onEmojiClick={(emojiData: EmojiClickData) => {
                onEmojiChange(emojiData.emoji);
                setIsEmojiDialogOpen(false);
              }}
            />
            <div className="flex justify-end border-t border-border p-3">
              <Button
                variant="outline"
                onClick={() => {
                  onEmojiChange("");
                  setIsEmojiDialogOpen(false);
                }}
              >
                {t("profiles.clearEmoji")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function readPickerTheme(): Theme {
  return document.documentElement.classList.contains("dark")
    ? Theme.DARK
    : Theme.LIGHT;
}
