import { useEffect } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useStore } from "@/lib/store";
import { StatusPill } from "./ui";

export function CommandMenu({ open, setOpen, onPiece, onCase, onWorkspace, onTeam }: {
  open: boolean; setOpen: (o: boolean) => void; onPiece: (wid: string, id: string) => void; onCase: (id: string) => void; onWorkspace: (id: string) => void; onTeam: () => void;
}) {
  const s = useStore();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(!open); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, setOpen]);
  const go = (fn: () => void) => { fn(); setOpen(false); };
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pieces, cases, people, workspaces…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Workspaces">{s.workspaces.map((w) => <CommandItem key={w.id} value={`ws ${w.name}`} onSelect={() => go(() => onWorkspace(w.id))}>{w.name}</CommandItem>)}</CommandGroup>
        <CommandGroup heading="Content pieces">{s.pieces.map((p) => <CommandItem key={p.id} value={`${p.title} ${p.keyword} ${p.id}`} onSelect={() => go(() => onPiece(p.workspaceId, p.id))}>
          <span className="flex-1 truncate">{p.title}</span><span className="text-xs text-muted-foreground">{s.workspaces.find((w) => w.id === p.workspaceId)?.short}</span><StatusPill status={p.status} approver={p.approver1 ?? p.approver2} className="h-5 min-w-16 text-[10px]" /></CommandItem>)}</CommandGroup>
        <CommandGroup heading="Client cases">{s.cases.map((c) => <CommandItem key={c.id} value={`case ${c.client} ${c.industry}`} onSelect={() => go(() => onCase(c.id))}>{c.client} <span className="text-xs text-muted-foreground">{c.industry}</span></CommandItem>)}</CommandGroup>
        <CommandGroup heading="People">{s.users.map((u) => <CommandItem key={u.id} value={`user ${u.name} ${u.roles.join(" ")}`} onSelect={() => go(onTeam)}>{u.name} <span className="text-xs text-muted-foreground">{u.roles.join(", ")}</span></CommandItem>)}</CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
