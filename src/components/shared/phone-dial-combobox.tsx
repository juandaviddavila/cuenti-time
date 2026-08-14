"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  flagEmoji,
  preferredCountryForDial,
  searchDialCountries,
} from "@/lib/phone/e164";
import type { DialCountry } from "@/lib/phone/dial-countries";

interface PhoneDialComboboxProps {
  value: string;
  onChange: (dial: string, country: DialCountry) => void;
  disabled?: boolean;
  className?: string;
}

export function PhoneDialCombobox({
  value,
  onChange,
  disabled,
  className,
}: PhoneDialComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [iso2, setIso2] = useState(
    () => preferredCountryForDial(value)?.iso2 ?? "CO"
  );

  useEffect(() => {
    const matchForIso = searchDialCountries("").find(
      (country) => country.dial === value && country.iso2 === iso2
    );
    if (matchForIso) return;
    const preferred = preferredCountryForDial(value);
    if (preferred) setIso2(preferred.iso2);
  }, [value, iso2]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected =
    searchDialCountries("").find(
      (country) => country.dial === value && country.iso2 === iso2
    ) ?? preferredCountryForDial(value);

  const options = useMemo(
    () => searchDialCountries(open ? query : "").slice(0, 100),
    [open, query]
  );

  function select(country: DialCountry) {
    setIso2(country.iso2);
    onChange(country.dial, country);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label="Indicativo de país"
        aria-expanded={open}
        aria-controls={listId}
        role="combobox"
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          if (!open) {
            setQuery("");
            queueMicrotask(() => inputRef.current?.focus());
          }
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-2.5 text-left text-sm outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className="truncate font-medium tracking-tight">
          {selected
            ? `${flagEmoji(selected.iso2)} ${selected.dial}`
            : value || "+57"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-50" />
      </button>

      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-[min(100vw-2rem,18rem)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="border-b p-2">
            <input
              ref={inputRef}
              type="search"
              autoComplete="off"
              value={query}
              placeholder="Buscar país o indicativo..."
              onChange={(event) => setQuery(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-56 overflow-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                Sin resultados
              </li>
            ) : (
              options.map((country) => {
                const selectedRow =
                  country.dial === value &&
                  country.iso2 === (selected?.iso2 ?? iso2);
                return (
                  <li
                    key={`${country.iso2}-${country.dial}`}
                    role="option"
                    aria-selected={selectedRow}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                        selectedRow && "bg-accent/60"
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => select(country)}
                    >
                      <span className="text-base leading-none" aria-hidden>
                        {flagEmoji(country.iso2)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {country.nameEs}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {country.dial}
                      </span>
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {selectedRow ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
