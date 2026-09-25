import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Btn, Empty, SectionTitle } from "@/components/ui-bits";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu Management — GetDishPack Ops Console" },
      {
        name: "description",
        content:
          "Manage the GetDishPack thali menu: availability, dietary tags and how many of today's stops carry each dish.",
      },
      { property: "og:title", content: "Menu Management — GetDishPack Ops Console" },
      {
        property: "og:description",
        content: "Toggle availability and see live demand per meal across today's delivery run.",
      },
    ],
  }),
  component: MenuManagement,
});

type Tag = "veg" | "jain" | "non-veg" | "low spice";

interface MenuItem {
  name: string;
  tags: Tag[];
  available: boolean;
}

function tagsFor(name: string): Tag[] {
  const n = name.toLowerCase();
  const t: Tag[] = [];
  if (n.includes("jain")) t.push("jain");
  if (n.includes("non-veg")) t.push("non-veg");
  else t.push("veg");
  if (n.includes("low spice")) t.push("low spice");
  return t;
}

function MenuManagement() {
  const { state } = useStore();
  const today = state.today;

  const demand = useMemo(() => {
    const m = new Map<string, number>();
    state.orders
      .filter((o) => o.date === today)
      .forEach((o) => m.set(o.mealSelection, (m.get(o.mealSelection) ?? 0) + 1));
    return m;
  }, [state.orders, today]);

  const [items, setItems] = useState<MenuItem[]>(() =>
    [...new Set(state.subscriptions.map((s) => s.defaultMeal))]
      .sort()
      .map((name) => ({ name, tags: tagsFor(name), available: true })),
  );
  const [draft, setDraft] = useState("");

  const totalStops = [...demand.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Menu Management"
        subtitle={`${items.length} dishes · ${items.filter((i) => i.available).length} available · ${totalStops} meals going out today`}
        right={
          <>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="New dish name"
              className="h-8 w-52 rounded-md border border-border bg-card px-2 text-[13px] outline-none"
            />
            <Btn
              variant="primary"
              onClick={() => {
                const name = draft.trim();
                if (!name) return;
                setItems((l) => (l.some((i) => i.name === name) ? l : [...l, { name, tags: tagsFor(name), available: true }]));
                setDraft("");
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add dish
            </Btn>
          </>
        }
      />

      <div className="px-5 py-4">
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <SectionTitle right={<span className="text-[12px] text-muted-foreground">demand = today&apos;s stops</span>}>
            Dishes
          </SectionTitle>
          <table className="w-full text-[13px]">
            <thead className="bg-surface-raised text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Dish</th>
                <th className="px-3 py-2 text-left font-medium">Tags</th>
                <th className="px-3 py-2 text-left font-medium">Subscriptions</th>
                <th className="px-3 py-2 text-left font-medium">Today&apos;s demand</th>
                <th className="px-3 py-2 text-left font-medium">Availability</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const subs = state.subscriptions.filter((s) => s.defaultMeal === i.name).length;
                const d = demand.get(i.name) ?? 0;
                return (
                  <tr key={i.name} className="h-9 border-b border-border last:border-0 hover:bg-accent">
                    <td className="px-3 font-medium">{i.name}</td>
                    <td className="px-3">
                      <span className="flex gap-1">
                        {i.tags.map((t) => (
                          <span key={t} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 tabular-nums text-muted-foreground">{subs}</td>
                    <td className="px-3 tabular-nums">{d}</td>
                    <td className="px-3">
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={i.available}
                          onChange={() =>
                            setItems((l) => l.map((x) => (x.name === i.name ? { ...x, available: !x.available } : x)))
                          }
                        />
                        <span className={i.available ? "text-[var(--status-delivered)]" : "text-[var(--status-failed)]"}>
                          {i.available ? "Available" : "Off menu"}
                        </span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 ? <Empty title="No dishes yet" hint="Add the first dish to build the menu." /> : null}
        </div>
      </div>
    </div>
  );
}
