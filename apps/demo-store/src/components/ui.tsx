import type { ReactNode } from "react";

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "danger"; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`notice notice-${tone}`}>
      {title && <strong className="block">{title}</strong>}
      {children}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function ErrorBox({ what, why, next }: { what: string; why?: string; next: string }) {
  return (
    <div role="alert" className="notice notice-danger">
      <strong className="block">{what}</strong>
      {why && <span className="block">{why}</span>}
      <span className="block">{next}</span>
    </div>
  );
}
