# shadcn/ui

The web app uses the `base-rhea` preset (Base UI), Hugeicons, and Tailwind CSS v4. The CLI is configured in [apps/web/components.json](apps/web/components.json).

Run these commands from the repo root to preview and add a component.

```sh
vp -C apps/web exec shadcn add dialog --dry-run
vp -C apps/web exec shadcn add dialog
```

- Review proposed overwrites before accepting them, especially for primitives already customized in this repo.
- Reuse primitives from `@/components/ui/*` and keep feature components outside `apps/web/src/components/ui`.
- Use component variants for appearance and `className` for layout on primitives. Use theme tokens from `apps/web/src/index.css` and static Tailwind classes. Keep raw colors, arbitrary values, and inline styles out of feature code.

[shadcn CLI reference](https://ui.shadcn.com/docs/cli)
