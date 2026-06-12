import { HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const classes =
    variant === "primary"
      ? "bg-accent text-white hover:bg-teal-800"
      : variant === "danger"
        ? "bg-danger text-white hover:bg-red-800"
        : "bg-white text-ink border border-border hover:bg-panel";
  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${classes} ${className}`}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-10 rounded-md border border-border bg-white px-3 text-sm ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-10 rounded-md border border-border bg-white px-3 text-sm ${props.className ?? ""}`} />;
}

export function Panel({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section {...props} className={`rounded-lg border border-border bg-white p-4 shadow-sm ${className}`} />;
}

export function Field({
  label,
  children,
  className = ""
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 text-sm font-medium text-ink ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function StatusPill({ value }: { value: string }) {
  const color =
    value === "completed" || value === "COMPLETE"
      ? "bg-emerald-100 text-emerald-800"
      : value.includes("error") || value === "FAILED"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{value}</span>;
}
