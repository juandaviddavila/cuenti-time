"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  countryFlagEmoji,
  findCountry,
  searchCountries,
} from "@/lib/countries";

interface CountryComboboxProps {
  value?: string;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CountryCombobox({
  value,
  onChange,
  placeholder = "Buscar país...",
  disabled,
}: CountryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = findCountry(value);
  const options = useMemo(() => searchCountries(query), [query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      modal
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="text-base leading-none" aria-hidden>
                {countryFlagEmoji(selected.code)}
              </span>
              {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="p-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre..."
            autoFocus
          />
        </div>
        <ScrollArea className="h-64">
          <ul className="p-1">
            {options.length === 0 ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                Sin resultados
              </li>
            ) : (
              options.map((country) => (
                <li key={country.code}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                      value === country.code && "bg-accent"
                    )}
                    onClick={() => {
                      onChange(country.code);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      {countryFlagEmoji(country.code)}
                    </span>
                    <span className="flex-1 text-left">{country.name}</span>
                    {value === country.code ? <Check className="h-4 w-4" /> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
