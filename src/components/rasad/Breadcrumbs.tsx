import { Link } from "react-router-dom";
import { ChevronLeft, Home } from "lucide-react";

export const Breadcrumbs = ({ items }: { items: { name: string; path?: string }[] }) => (
  <nav aria-label="breadcrumb" className="container pt-6">
    <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <li>
        <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground">
          <Home className="h-3.5 w-3.5" />
          الرئيسية
        </Link>
      </li>
      {items.map((it, i) => (
        <li key={i} className="inline-flex items-center gap-1.5">
          <ChevronLeft className="h-3.5 w-3.5 opacity-60" />
          {it.path ? (
            <Link to={it.path} className="hover:text-foreground">{it.name}</Link>
          ) : (
            <span className="text-foreground">{it.name}</span>
          )}
        </li>
      ))}
    </ol>
  </nav>
);
