import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { cn } from "cn";

function NavigationMenu({ className, ...props }: NavigationMenuPrimitive.Root.Props) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={cn(
        "flex min-w-0 items-center rounded-full border bg-card p-1 text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function NavigationMenuList({ className, ...props }: NavigationMenuPrimitive.List.Props) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn("flex list-none items-center", className)}
      {...props}
    />
  );
}

function NavigationMenuItem(props: NavigationMenuPrimitive.Item.Props) {
  return <NavigationMenuPrimitive.Item data-slot="navigation-menu-item" {...props} />;
}

function NavigationMenuLink({
  active,
  children,
  className,
  ...props
}: NavigationMenuPrimitive.Link.Props) {
  return (
    <NavigationMenuPrimitive.Link
      active={active}
      data-slot="navigation-menu-link"
      className={cn(
        "relative isolate flex size-12 items-center justify-center gap-2 rounded-full text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none not-data-active:hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-1 focus-visible:outline-ring data-active:text-foreground sm:h-9 sm:w-auto sm:px-3 sm:text-sm",
        className,
      )}
      {...props}
    >
      {active && (
        <span
          aria-hidden="true"
          data-slot="navigation-menu-highlight"
          className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-foreground/12"
        />
      )}
      {children}
    </NavigationMenuPrimitive.Link>
  );
}

export { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList };
