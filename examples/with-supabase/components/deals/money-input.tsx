"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Money is stored as integer pence. Users type pounds (up to 2dp); the parent
 * receives pence (or null while the field is empty/partial). GBP only.
 */
export function MoneyInput({
  id,
  valuePence,
  onChangePence,
  placeholder = "0.00",
  required,
  disabled,
  className,
}: {
  id?: string;
  valuePence: number | null;
  onChangePence: (pence: number | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = React.useState(
    valuePence != null ? (valuePence / 100).toFixed(2) : "",
  );

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        £
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        className={cn("pl-6", className)}
        value={text}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          if (!/^\d*\.?\d{0,2}$/.test(raw)) return;
          setText(raw);
          if (raw === "" || raw === ".") {
            onChangePence(null);
            return;
          }
          const pounds = Number.parseFloat(raw);
          onChangePence(
            Number.isFinite(pounds) ? Math.round(pounds * 100) : null,
          );
        }}
      />
    </div>
  );
}
