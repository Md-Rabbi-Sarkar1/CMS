import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: string | undefined; action?: ReactNode | undefined }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
