import { DatabaseIcon } from "lucide-react";

export function DbNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900">
      <DatabaseIcon className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">Database not connected</p>
        <p className="text-amber-800">
          You can still create, preview and download cards. To save cards, brands and templates, start PostgreSQL
          (<code>docker compose up -d</code>) and run <code>npm run db:push</code>.
        </p>
      </div>
    </div>
  );
}
