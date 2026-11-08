import type { ReactNode } from "react";
import { cn } from "cn";
import type { ReactTable, RowData } from "@tanstack/react-table";
import { ArrowDown01Icon, ArrowUp01Icon, ArrowUpDownIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { dataTableFeatures } from "@/components/ui/data-table-features";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DataTableProps<TData extends RowData> = {
  table: ReactTable<typeof dataTableFeatures, TData>;
  label: string;
  filter?: { column: string; label: string; onChange?: () => void };
  selectable?: boolean;
  unselectedStatus?: string;
  tableClassName?: string;
  toolbarControls?: ReactNode;
  toolbarActions?: ReactNode;
};

export function DataTable<TData extends RowData>({
  table,
  label,
  filter,
  selectable = false,
  unselectedStatus,
  tableClassName,
  toolbarControls,
  toolbarActions,
}: DataTableProps<TData>) {
  const filterColumn = filter ? table.getColumn(filter.column) : undefined;
  const filterValue = filterColumn?.getFilterValue();
  const rows = table.getRowModel().rows;
  const filteredCount = selectable ? table.getFilteredRowModel().rows.length : 0;
  const selectedCount = selectable ? table.getFilteredSelectedRowModel().rows.length : 0;
  const allPageRowsSelected = selectable && table.getIsAllPageRowsSelected();
  const showPagination = table.getPageCount() > 1;

  return (
    <div className="w-full min-w-0">
      {(filter || toolbarControls || toolbarActions) && (
        <div className={cn("flex flex-wrap items-end gap-2 pb-4", !toolbarControls && "pt-4")}>
          {toolbarControls && (
            <div className="flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto">
              {toolbarControls}
            </div>
          )}
          {(filter || toolbarActions) && (
            <div className="ml-auto flex w-full min-w-0 flex-wrap items-end justify-end gap-2 sm:w-auto">
              {filter && (
                <Field className="w-full sm:w-44">
                  <Input
                    aria-label={filter.label}
                    placeholder={filter.label}
                    value={typeof filterValue === "string" ? filterValue : ""}
                    onChange={(event) => {
                      filterColumn?.setFilterValue(event.target.value);
                      filter.onChange?.();
                    }}
                  />
                </Field>
              )}
              {toolbarActions}
            </div>
          )}
        </div>
      )}
      <div className="overflow-hidden rounded-md border">
        <Table aria-label={label} className={tableClassName}>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {selectable && (
                  <TableHead scope="col" className="w-8">
                    <Checkbox
                      aria-label={`Select all rows on this page of ${label}`}
                      checked={allPageRowsSelected}
                      indeterminate={!allPageRowsSelected && table.getIsSomePageRowsSelected()}
                      onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                      disabled={!rows.length}
                    />
                  </TableHead>
                )}
                {group.headers.map((header) => {
                  const { column } = header;
                  const sorted = column.getIsSorted();
                  const layout = column.columnDef.meta;
                  const rightAligned = layout?.align === "right";
                  const sortIcon = (
                    <HugeiconsIcon
                      icon={
                        sorted === "asc"
                          ? ArrowUp01Icon
                          : sorted === "desc"
                            ? ArrowDown01Icon
                            : ArrowUpDownIcon
                      }
                      data-icon={rightAligned ? "inline-start" : "inline-end"}
                      aria-hidden="true"
                    />
                  );
                  return (
                    <TableHead
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined
                      }
                      className={cn(
                        layout?.headerClassName,
                        rightAligned && "text-right",
                        layout?.align === "center" && "text-center",
                      )}
                    >
                      {column.getCanSort() ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={column.getToggleSortingHandler()}
                          className={cn(rightAligned && "-mr-3", !layout?.align && "-ml-3")}
                        >
                          {rightAligned && sortIcon}
                          <table.FlexRender header={header} />
                          {!rightAligned && sortIcon}
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={selectable && row.getIsSelected() ? "selected" : undefined}
                >
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        aria-label={`Select row ${row.index + 1} in ${label}`}
                        checked={row.getIsSelected()}
                        onCheckedChange={(checked) => row.toggleSelected(checked)}
                      />
                    </TableCell>
                  )}
                  {row.getAllCells().map((cell) => {
                    const layout = cell.column.columnDef.meta;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          layout?.cellClassName,
                          layout?.align === "right" && "text-right",
                          layout?.align === "center" && "text-center",
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllLeafColumns().length + Number(selectable)}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {(selectable || showPagination) && (
        <div className="flex flex-wrap items-center justify-end gap-2 py-4">
          {selectable && (
            <p className="flex-1 text-sm text-muted-foreground" role="status">
              {selectedCount === 0 && unselectedStatus
                ? unselectedStatus
                : `${selectedCount} of ${filteredCount} ${filteredCount === 1 ? "row" : "rows"} selected.`}
            </p>
          )}
          {showPagination && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
