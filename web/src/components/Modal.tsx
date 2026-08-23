import type { FormEvent, ReactNode } from "react";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";

export interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  confirmText?: string;
  cancelText?: string;
  className?: string;
}

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  onSubmit,
  confirmText = "Salvar",
  cancelText = "Cancelar",
  className,
}: ModalProps) {
  const content = (
    <>
      <DialogPanel className="grid gap-4">{children}</DialogPanel>
      {footer !== undefined ? (
        footer ? <DialogFooter>{footer}</DialogFooter> : null
      ) : (
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="ghost" />}>
            {cancelText}
          </DialogClose>
          <Button type={onSubmit ? "submit" : "button"}>{confirmText}</Button>
        </DialogFooter>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : null}
      <DialogPopup className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {onSubmit ? (
          <Form className="contents" onSubmit={onSubmit}>
            {content}
          </Form>
        ) : (
          content
        )}
      </DialogPopup>
    </Dialog>
  );
}
