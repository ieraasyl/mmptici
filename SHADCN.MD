# shadcn/ui

The web app uses the `base-rhea` preset (Base UI), Hugeicons, and Tailwind CSS v4. The CLI is configured in [apps/web/components.json](apps/web/components.json).

Run these commands from the repo root to preview and add a component.

```sh
vp -C apps/web exec shadcn add dialog --dry-run
vp -C apps/web exec shadcn add dialog
```

- Review proposed overwrites before accepting them, especially for primitives already customized in this repo.
- Reuse primitives from `@/components/ui/*` and keep feature components outside `apps/web/src/components/ui`.

## Rules

Run `vp check` from the repo root. [vite.config.ts](vite.config.ts) sets these rules to error for web TypeScript and TSX files.

| Lint rule                                                                                                                     | What to do                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`shadcn/no-restyle`](https://raw.githubusercontent.com/shadcn-ui/lint/main/docs/rules/no-restyle.md)                         | Use a primitive's `variant` and `size` for appearance. Use `className` for layout. |
| [`shadcn/no-raw-colors`](https://raw.githubusercontent.com/shadcn-ui/lint/main/docs/rules/no-raw-colors.md)                   | Use semantic theme classes such as `bg-primary` and `text-muted-foreground`.       |
| [`shadcn/no-arbitrary-values`](https://raw.githubusercontent.com/shadcn-ui/lint/main/docs/rules/no-arbitrary-values.md)       | Use the Tailwind scale and theme tokens from `apps/web/src/index.css`.             |
| [`shadcn/no-inline-styles`](https://raw.githubusercontent.com/shadcn-ui/lint/main/docs/rules/no-inline-styles.md)             | Use classes and theme CSS in place of inline styles.                               |
| [`shadcn/no-unknown-classes`](https://raw.githubusercontent.com/shadcn-ui/lint/main/docs/rules/no-unknown-classes.md)         | Use classes Tailwind can resolve with the current theme.                           |
| [`shadcn/require-static-classes`](https://raw.githubusercontent.com/shadcn-ui/lint/main/docs/rules/require-static-classes.md) | Pass complete class strings to `cn()` or use a variant.                            |

Primitive implementations in `apps/web/src/components/ui` are exempt from `no-restyle`, `no-arbitrary-values`, and `require-static-classes`.

- Follow each component's composition tree. Put menu items inside their groups and give every Dialog, Sheet, and Drawer a title. [Composition rules](https://raw.githubusercontent.com/shadcn-ui/ui/main/skills/shadcn/rules/composition.md)
- Use the Base UI `render` prop for custom triggers. [Base UI API differences](https://raw.githubusercontent.com/shadcn-ui/ui/main/skills/shadcn/rules/base-vs-radix.md)
- Build forms with `FieldGroup` and `Field`. Put `data-invalid` on the field and `aria-invalid` on the control. [Form rules](https://raw.githubusercontent.com/shadcn-ui/ui/main/skills/shadcn/rules/forms.md)
- Use Hugeicons. On icons inside a `Button`, set `data-icon="inline-start"` or `data-icon="inline-end"` and let the button size the icon. [Icon rules](https://raw.githubusercontent.com/shadcn-ui/ui/main/skills/shadcn/rules/icons.md)

[Styling rules](https://raw.githubusercontent.com/shadcn-ui/ui/main/skills/shadcn/rules/styling.md) · [Chat rules](https://raw.githubusercontent.com/shadcn-ui/ui/main/skills/shadcn/rules/chat.md)

## Registry components

Check [the local component directory](apps/web/src/components/ui) before adding a component. Read the linked Markdown for the component you plan to use and pass its registry name to the `add` command above.

| Registry name                                                                        | Use it for                                                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [`accordion`](https://ui.shadcn.com/docs/components/base/accordion.md)               | Let readers open sections of a rubric or FAQ one at a time.                       |
| [`alert`](https://ui.shadcn.com/docs/components/base/alert.md)                       | Keep a warning, error, or important note visible in the page.                     |
| [`alert-dialog`](https://ui.shadcn.com/docs/components/base/alert-dialog.md)         | Ask for a decision before a destructive action such as deleting a checklist.      |
| [`aspect-ratio`](https://ui.shadcn.com/docs/components/base/aspect-ratio.md)         | Keep a media preview at a fixed width-to-height ratio.                            |
| [`attachment`](https://ui.shadcn.com/docs/components/base/attachment.md)             | Show an attached file with its name, preview, upload status, and actions.         |
| [`avatar`](https://ui.shadcn.com/docs/components/base/avatar.md)                     | Identify a participant with a photo or initials.                                  |
| [`badge`](https://ui.shadcn.com/docs/components/base/badge.md)                       | Mark statuses and verdicts such as Pending review, Yes, No, or N/A.               |
| [`breadcrumb`](https://ui.shadcn.com/docs/components/base/breadcrumb.md)             | Show the path from the conversation list to the current evaluation.               |
| [`bubble`](https://ui.shadcn.com/docs/components/base/bubble.md)                     | Display the text of a chat turn inside a speech bubble.                           |
| [`button`](https://ui.shadcn.com/docs/components/base/button.md)                     | Run an evaluation, save a checklist, or trigger another action.                   |
| [`button-group`](https://ui.shadcn.com/docs/components/base/button-group.md)         | Keep related actions, such as Save and its options menu, together.                |
| [`calendar`](https://ui.shadcn.com/docs/components/base/calendar.md)                 | Select a date or date range from a calendar grid.                                 |
| [`card`](https://ui.shadcn.com/docs/components/base/card.md)                         | Group related content such as a score summary or conversation overview.           |
| [`carousel`](https://ui.shadcn.com/docs/components/base/carousel.md)                 | Browse a series of images or previews in a limited space.                         |
| [`chart`](https://ui.shadcn.com/docs/components/base/chart.md)                       | Plot score trends, distributions, or comparisons.                                 |
| [`checkbox`](https://ui.shadcn.com/docs/components/base/checkbox.md)                 | Select multiple conversations or enable independent options in a form.            |
| [`code-block`](https://ui.shadcn.com/docs/components/base/code-block.md)             | Display copyable JSON, code, logs, or diffs.                                      |
| [`collapsible`](https://ui.shadcn.com/docs/components/base/collapsible.md)           | Expand a single section, such as an evaluation explanation.                       |
| [`combobox`](https://ui.shadcn.com/docs/components/base/combobox.md)                 | Search a long list and select a matching option.                                  |
| [`command`](https://ui.shadcn.com/docs/components/base/command.md)                   | Search for and run actions from a command palette.                                |
| [`context-menu`](https://ui.shadcn.com/docs/components/base/context-menu.md)         | Offer actions on a row or item through a context click.                           |
| [`dialog`](https://ui.shadcn.com/docs/components/base/dialog.md)                     | Collect an appeal or edit a short form in a modal.                                |
| [`direction`](https://ui.shadcn.com/docs/components/base/direction.md)               | Set left-to-right or right-to-left direction for a section or app.                |
| [`drawer`](https://ui.shadcn.com/docs/components/base/drawer.md)                     | Open a swipeable panel for filters or actions on a small screen.                  |
| [`dropdown-menu`](https://ui.shadcn.com/docs/components/base/dropdown-menu.md)       | Put secondary actions behind a button, such as a row's overflow menu.             |
| [`empty`](https://ui.shadcn.com/docs/components/base/empty.md)                       | Explain why a list is empty and show what to do next.                             |
| [`field`](https://ui.shadcn.com/docs/components/base/field.md)                       | Group a form control with its label, help text, and validation error.             |
| [`form`](https://ui.shadcn.com/docs/forms/react-hook-form.md)                        | Legacy entry. Use `Field` with React Hook Form for new forms.                     |
| [`hover-card`](https://ui.shadcn.com/docs/components/base/hover-card.md)             | Preview linked content without opening its page.                                  |
| [`input`](https://ui.shadcn.com/docs/components/base/input.md)                       | Enter a single-line value such as a checklist name or criterion weight.           |
| [`input-group`](https://ui.shadcn.com/docs/components/base/input-group.md)           | Put a search icon, unit, or clear button next to an input.                        |
| [`input-otp`](https://ui.shadcn.com/docs/components/base/input-otp.md)               | Enter or paste a one-time verification code.                                      |
| [`item`](https://ui.shadcn.com/docs/components/base/item.md)                         | Present a list entry with a title, description, icon, and actions.                |
| [`kbd`](https://ui.shadcn.com/docs/components/base/kbd.md)                           | Display a keyboard shortcut or key sequence.                                      |
| [`label`](https://ui.shadcn.com/docs/components/base/label.md)                       | Name a standalone form control. Use `FieldLabel` inside a `Field`.                |
| [`marker`](https://ui.shadcn.com/docs/components/base/marker.md)                     | Mark a transcript event such as a date change or an agent joining.                |
| [`menubar`](https://ui.shadcn.com/docs/components/base/menubar.md)                   | Keep desktop-style command menus visible at the top of a workspace.               |
| [`message`](https://ui.shadcn.com/docs/components/base/message.md)                   | Lay out a transcript turn with its speaker, timestamp, and content.               |
| [`message-scroller`](https://ui.shadcn.com/docs/components/base/message-scroller.md) | Scroll a transcript and jump to a cited message.                                  |
| [`native-select`](https://ui.shadcn.com/docs/components/base/native-select.md)       | Let the browser handle a simple single-choice picker.                             |
| [`navigation-menu`](https://ui.shadcn.com/docs/components/base/navigation-menu.md)   | Present primary links across sections of the app.                                 |
| [`pagination`](https://ui.shadcn.com/docs/components/base/pagination.md)             | Move between pages of results.                                                    |
| [`popover`](https://ui.shadcn.com/docs/components/base/popover.md)                   | Show a small filter panel or extra controls next to a trigger.                    |
| [`progress`](https://ui.shadcn.com/docs/components/base/progress.md)                 | Show how much of a batch evaluation has finished.                                 |
| [`questionnaire`](https://ui.shadcn.com/docs/components/base/questionnaire.md)       | Guide someone through a sequence of choice and free-text questions.               |
| [`radio-group`](https://ui.shadcn.com/docs/components/base/radio-group.md)           | Keep a small set of mutually exclusive options visible, such as Yes, No, and N/A. |
| [`resizable`](https://ui.shadcn.com/docs/components/base/resizable.md)               | Let reviewers adjust the width of transcript and scorecard panes.                 |
| [`scroll-area`](https://ui.shadcn.com/docs/components/base/scroll-area.md)           | Keep a long transcript or list scrollable inside a fixed panel.                   |
| [`select`](https://ui.shadcn.com/docs/components/base/select.md)                     | Choose one option from a styled menu, such as a checklist or criterion type.      |
| [`separator`](https://ui.shadcn.com/docs/components/base/separator.md)               | Divide sections within a form, panel, or toolbar.                                 |
| [`sheet`](https://ui.shadcn.com/docs/components/base/sheet.md)                       | Open transcript evidence in a panel from the edge of the screen.                  |
| [`sidebar`](https://ui.shadcn.com/docs/components/base/sidebar.md)                   | Keep main workspace destinations in a persistent side panel.                      |
| [`skeleton`](https://ui.shadcn.com/docs/components/base/skeleton.md)                 | Reserve space for a scorecard or table while its data loads.                      |
| [`slider`](https://ui.shadcn.com/docs/components/base/slider.md)                     | Choose a value from a range, such as a score threshold.                           |
| [`sonner`](https://raw.githubusercontent.com/emilkowalski/sonner/main/README.md)     | Show brief notifications through the Sonner toast library.                        |
| [`spinner`](https://ui.shadcn.com/docs/components/base/spinner.md)                   | Indicate that an action is running when its progress is unknown.                  |
| [`switch`](https://ui.shadcn.com/docs/components/base/switch.md)                     | Turn a setting on or off, such as allowing N/A for a criterion.                   |
| [`table`](https://ui.shadcn.com/docs/components/base/table.md)                       | Display conversations or criterion scores in rows and columns.                    |
| [`tabs`](https://ui.shadcn.com/docs/components/base/tabs.md)                         | Switch between views in one panel, such as Overview and History.                  |
| [`textarea`](https://ui.shadcn.com/docs/components/base/textarea.md)                 | Write criterion instructions, appeal comments, or review notes.                   |
| [`toast`](https://ui.shadcn.com/docs/components/base/toast.md)                       | Give brief feedback after an action, such as saving a review.                     |
| [`toggle`](https://ui.shadcn.com/docs/components/base/toggle.md)                     | Use a button to turn a display mode on or off.                                    |
| [`toggle-group`](https://ui.shadcn.com/docs/components/base/toggle-group.md)         | Choose among compact toolbar options, such as list and grid view.                 |
| [`tooltip`](https://ui.shadcn.com/docs/components/base/tooltip.md)                   | Provide a short hint or explain an icon when it receives focus or hover.          |
| [`trace`](https://ui.shadcn.com/docs/components/base/trace.md)                       | Show an expandable record of evaluation steps, tool calls, and sources.           |

## Recipes

| Recipe                                                                   | Use it for                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [Data Table](https://ui.shadcn.com/docs/components/base/data-table.md)   | Add sorting, filtering, selection, or pagination to a `table` with TanStack Table. |
| [Date Picker](https://ui.shadcn.com/docs/components/base/date-picker.md) | Combine a `popover` and `calendar` to pick dates from a form field.                |
| [Typography](https://ui.shadcn.com/docs/typeset.md)                      | Style headings, paragraphs, lists, and quotes with a consistent type scale.        |

## AI Elements

AI Elements are examples built by composing shadcn/ui primitives. Copy the Base UI example you need into `apps/web/src/components/ai-elements/` and add the dependencies listed on its page. Patterns built on Trace commonly use `trace` and `code-block`.

```sh
vp -C apps/web exec shadcn add trace code-block --dry-run
```

| Pattern                                                                             | Use it for                                                                    |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [Chain of Thought](https://ui.shadcn.com/docs/ai-elements/base/chain-of-thought.md) | Expand a short activity summary into the steps the system took.               |
| [Chat](https://ui.shadcn.com/docs/ai-elements/base/chat.md)                         | Render a conversation with `message-scroller` handling scroll position.       |
| [Checkpoint](https://ui.shadcn.com/docs/ai-elements/base/checkpoint.md)             | Mark a conversation state that the app can restore.                           |
| [Confirmation](https://ui.shadcn.com/docs/ai-elements/base/confirmation.md)         | Ask for approval before a proposed action runs.                               |
| [Context](https://ui.shadcn.com/docs/ai-elements/base/context.md)                   | Show how much of the model's context window is in use.                        |
| [File Tree](https://ui.shadcn.com/docs/ai-elements/base/file-tree.md)               | Browse files and folders associated with a run.                               |
| [Inline Citation](https://ui.shadcn.com/docs/ai-elements/base/inline-citation.md)   | Attach an evidence reference to a specific sentence.                          |
| [Message](https://ui.shadcn.com/docs/ai-elements/base/message.md)                   | Compose a chat turn that includes messages, attachments, and related actions. |
| [Model Selector](https://ui.shadcn.com/docs/ai-elements/base/model-selector.md)     | Choose a model and, where supported, its reasoning effort.                    |
| [Plan](https://ui.shadcn.com/docs/ai-elements/base/plan.md)                         | List planned steps and show which ones have finished.                         |
| [Prompt Input](https://ui.shadcn.com/docs/ai-elements/base/prompt-input.md)         | Compose and send a message with optional attachments.                         |
| [Queue](https://ui.shadcn.com/docs/ai-elements/base/queue.md)                       | Separate pending evaluations from completed ones.                             |
| [Reasoning](https://ui.shadcn.com/docs/ai-elements/base/reasoning.md)               | Display a reasoning summary supplied by the model as it arrives.              |
| [Sources](https://ui.shadcn.com/docs/ai-elements/base/sources.md)                   | Collect the references used to support a result.                              |
| [Stack Trace](https://ui.shadcn.com/docs/ai-elements/base/stack-trace.md)           | Inspect the stack frames behind a failed tool call.                           |
| [Subagent](https://ui.shadcn.com/docs/ai-elements/base/subagent.md)                 | Inspect a delegated run, its calls, and its result.                           |
| [Suggestion](https://ui.shadcn.com/docs/ai-elements/base/suggestion.md)             | Offer a prompt the user can select with one click.                            |
| [Task](https://ui.shadcn.com/docs/ai-elements/base/task.md)                         | Follow activity and progress within one running task.                         |
| [Terminal](https://ui.shadcn.com/docs/ai-elements/base/terminal.md)                 | Follow a command and its live output.                                         |
| [Test Results](https://ui.shadcn.com/docs/ai-elements/base/test-results.md)         | Review test suites and inspect individual failures.                           |
| [Tool](https://ui.shadcn.com/docs/ai-elements/base/tool.md)                         | Inspect a tool call's status, input, output, or error.                        |

For transcript review, use `message` with `message-scroller` and link each finding to its supporting turn. For recorded calls, pair native audio controls with timestamp buttons that seek to the cited segment.

If you bring in an existing AI SDK Elements wrapper, use the upstream migration guide to find the corresponding pattern and preserve the wrapper's exports and props. [AI SDK Elements migration guide](https://ui.shadcn.com/docs/ai-elements.md#migrating-from-ai-sdk-elements)

[Full component catalog](https://ui.shadcn.com/docs/components.md) · [AI Elements catalog](https://ui.shadcn.com/docs/ai-elements.md) · [shadcn CLI reference](https://ui.shadcn.com/docs/cli.md)
