import type { ReactNode } from "react";
import { Toast } from "@base-ui/react/toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Cancel01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal>
      <Toast.Viewport className="pointer-events-none fixed inset-x-4 top-4 z-50 mx-auto flex w-auto max-w-sm flex-col gap-2 outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full">
        {toasts.map((item) => (
          <Toast.Root
            key={item.id}
            toast={item}
            className="pointer-events-auto rounded-2xl border bg-popover text-popover-foreground shadow-lg transition-opacity data-ending-style:opacity-0 data-limited:hidden data-starting-style:opacity-0"
          >
            <Toast.Content className="flex items-start gap-3 p-4">
              <HugeiconsIcon
                icon={
                  item.type === "loading"
                    ? Loading03Icon
                    : item.type === "error"
                      ? AlertCircleIcon
                      : Tick02Icon
                }
                size={18}
                className={cn("mt-0.5 shrink-0", item.type === "loading" && "animate-spin")}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <Toast.Title className="text-sm font-medium wrap-anywhere" />
                <Toast.Description className="text-sm wrap-anywhere text-muted-foreground" />
              </div>
              <Toast.Close
                aria-label="Dismiss notification"
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" />
              </Toast.Close>
            </Toast.Content>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

function Toaster({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={toast}>
      {children}
      <ToastList />
    </Toast.Provider>
  );
}

export { Toaster };
