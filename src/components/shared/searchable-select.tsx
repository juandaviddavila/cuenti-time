"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectBaseProps {
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** Label shown when nothing is selected in multiple mode. Default: "Todos" */
  allLabel?: string;
}

interface SearchableSelectSingleProps extends SearchableSelectBaseProps {
  multiple?: false;
  value: string;
  onValueChange: (value: string) => void;
}

interface SearchableSelectMultipleProps extends SearchableSelectBaseProps {
  multiple: true;
  value: string[];
  onValueChange: (value: string[]) => void;
}

export type SearchableSelectProps =
  | SearchableSelectSingleProps
  | SearchableSelectMultipleProps;

export function SearchableSelect(props: SearchableSelectProps) {
  const {
    options,
    placeholder = "Seleccione...",
    searchPlaceholder = "Buscar...",
    emptyMessage = "Sin resultados",
    className,
    triggerClassName,
    disabled = false,
    allLabel = "Todos",
  } = props;

  const multiple = props.multiple === true;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [triggerWidth, setTriggerWidth] = useState<number>();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedValues = useMemo(() => {
    if (multiple) return props.value;
    return props.value ? [props.value] : [];
  }, [multiple, props.value]);

  const selectedLabel = useMemo(() => {
    if (multiple) {
      if (props.value.length === 0) return allLabel;
      if (props.value.length === 1) {
        return (
          options.find((o) => o.value === props.value[0])?.label ??
          props.value[0]
        );
      }
      return `${props.value.length} seleccionados`;
    }
    return options.find((o) => o.value === props.value)?.label;
  }, [multiple, props, options, allLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function toggleMulti(optionValue: string) {
    if (!multiple) return;
    const current = props.value;
    const next = current.includes(optionValue)
      ? current.filter((v) => v !== optionValue)
      : [...current, optionValue];
    props.onValueChange(next);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next && triggerRef.current) {
          setTriggerWidth(triggerRef.current.offsetWidth);
        }
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            (!selectedLabel || (multiple && props.value.length === 0)) &&
              "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("p-0", className)}
        style={triggerWidth ? { width: triggerWidth } : undefined}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center border-b px-2">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
        </div>
        <ScrollArea className="h-56">
          <div className="p-1">
            {multiple && (
              <button
                type="button"
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  props.value.length === 0 && "bg-accent/60"
                )}
                onClick={() => {
                  props.onValueChange([]);
                }}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {props.value.length === 0 ? (
                    <Check className="h-4 w-4" />
                  ) : null}
                </span>
                <span className="truncate">{allLabel}</span>
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              filtered.map((option) => {
                const selected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                      selected && "bg-accent/60"
                    )}
                    onClick={() => {
                      if (multiple) {
                        toggleMulti(option.value);
                        return;
                      }
                      props.onValueChange(option.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
