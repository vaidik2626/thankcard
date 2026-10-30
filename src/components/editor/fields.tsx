"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function Field({
  label,
  required,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px]">
        {label}
        {required ? <span className="text-destructive">*</span> : <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  required,
  hint,
  error,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <Input
        id={id}
        type={type}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </Field>
  );
}

/** Slider plus numeric input for design values. */
export function NumberControl({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.5,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-1">
        <Input
          id={id}
          type="number"
          value={Number.isFinite(value) ? Number(value.toFixed(3)) : ""}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="h-7 w-[4.5rem] px-2 text-right text-xs tabular-nums"
        />
        {unit && <span className="w-5 text-[11px] text-muted-foreground">{unit}</span>}
      </div>
      <Slider
        className="col-span-2"
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : (v as number))}
        aria-label={label}
      />
    </div>
  );
}

export function NativeSelect({
  value,
  onChange,
  options,
  id,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  id?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
