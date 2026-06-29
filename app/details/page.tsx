import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDailyTotals } from "@/app/actions/meals";
import LocalTime from "./LocalTime";
import { ArrowLeft, ChevronRight } from "lucide-react";

const MEAL_ORDER = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
type MealType = (typeof MEAL_ORDER)[number];

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function DayDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { date: dateParam } = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const date = dateParam || today;

  const { totalCalories, totalProtein, meals } = await getDailyTotals(date);

  // Group meals by type, preserving chrono order within each group
  const grouped = MEAL_ORDER.reduce(
    (acc, type) => {
      acc[type] = meals.filter((m) => m.mealType === type);
      return acc;
    },
    {} as Record<MealType, typeof meals>
  );

  const hasMeals = meals.length > 0;
  const returnTo = `/details?date=${date}`;

  return (
    <main className="min-h-screen flex flex-col max-w-lg mx-auto" style={{ background: "#FFF7F0" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 px-5 py-3 flex items-center" style={{ background: "#FFF7F0", borderBottom: "1px solid rgba(80,40,10,0.08)" }}>
        <Link href={`/?date=${date}`} className="flex items-center gap-1 shrink-0" style={{ color: "#FF7A1A" }}>
          <ArrowLeft size={18} strokeWidth={2.5} />
          <span className="font-jakarta font-medium text-base">Back</span>
        </Link>
        <h1 className="font-fredoka font-medium absolute left-0 right-0 text-center pointer-events-none" style={{ color: "#2B2018", fontSize: 22 }}>
          {formatDate(date)}
        </h1>
      </header>

      {/* Daily totals strip */}
      <div className="mx-5 mt-4 px-5 py-4 flex" style={{ background: "#FFF1EA", borderRadius: 18 }}>
        <div className="flex-1">
          <p className="font-jakarta font-bold uppercase" style={{ color: "#B07A4E", fontSize: 11, letterSpacing: 1 }}>Total Cal</p>
          <p className="font-fredoka tabular-nums" style={{ fontSize: 32, color: "#FF7A1A", lineHeight: 1.1 }}>
            {Math.round(totalCalories).toLocaleString()}
          </p>
        </div>
        <div style={{ width: 1, background: "#F2E6DB", margin: "0 16px" }} />
        <div className="flex-1">
          <p className="font-jakarta font-bold uppercase" style={{ color: "#B07A4E", fontSize: 11, letterSpacing: 1 }}>Total Protein</p>
          <p className="font-fredoka tabular-nums" style={{ fontSize: 32, color: "#FF5A6E", lineHeight: 1.1 }}>
            {Math.round(totalProtein)}<span className="font-fredoka" style={{ fontSize: 18 }}>g</span>
          </p>
        </div>
      </div>

      {/* Meal groups */}
      <div className="flex-1 px-5 py-4 space-y-5">
        {!hasMeals && (
          <p className="text-center font-jakarta text-sm mt-10" style={{ color: "#B7A597" }}>
            No meals logged for this day.
          </p>
        )}

        {MEAL_ORDER.map((type) => {
          const group = grouped[type];
          if (group.length === 0) return null;

          return (
            <section key={type}>
              <h2 className="font-jakarta font-bold uppercase mb-2 px-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
                {type}
              </h2>
              <div className="space-y-2">
                {group.map((meal) => {
                  const mealCals = meal.mealItems.reduce(
                    (s, i) => s + i.caloriesSnapshot,
                    0
                  );
                  const mealProtein = meal.mealItems.reduce(
                    (s, i) => s + i.proteinSnapshot,
                    0
                  );

                  return (
                    <div
                      key={meal.id}
                      className="overflow-hidden"
                      style={{ background: "#FFFFFF", borderRadius: 22, boxShadow: "0 8px 24px rgba(80,40,10,0.08)" }}
                    >
                      {/* Meal header — tappable to edit */}
                      <Link
                        href={`/meal/${meal.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
                        className="flex items-center justify-between px-4 py-3 active:opacity-70"
                        style={{ background: "#FFFFFF" }}
                      >
                        <span className="font-jakarta text-xs" style={{ color: "#9A897B" }}>
                          <LocalTime iso={meal.time.toISOString()} />
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-fredoka font-medium tabular-nums" style={{ color: "#FF7A1A", fontSize: 16 }}>
                            {Math.round(mealCals).toLocaleString()} cal
                          </span>
                          <span className="font-fredoka font-medium tabular-nums" style={{ color: "#FF5A6E", fontSize: 16 }}>
                            {Math.round(mealProtein)}g
                          </span>
                          <ChevronRight size={16} style={{ color: "#D4C4B8" }} />
                        </div>
                      </Link>

                      {/* Items list */}
                      <div style={{ borderTop: "1px solid #F5ECE3" }}>
                        {meal.mealItems.map((item) => {
                          const name =
                            item.food?.name ?? item.recipe?.name ?? item.customName ?? "Unknown";
                          const label =
                            item.itemType === "custom"
                              ? "Quick Add"
                              : item.servingsMultiplier === 1
                              ? "1 serving"
                              : `${item.servingsMultiplier}× servings`;
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between px-4 py-2.5 last:border-0"
                              style={{ borderBottom: "1px solid #F5ECE3" }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-jakarta font-semibold truncate" style={{ fontSize: 15, color: "#2B2018" }}>
                                  {name}
                                </p>
                                <p className="font-jakarta" style={{ fontSize: 13, color: "#9A897B" }}>{label}</p>
                              </div>
                              <div className="text-right ml-3 shrink-0">
                                <p className="font-jakarta font-medium tabular-nums" style={{ fontSize: 14, color: "#FF7A1A" }}>
                                  {Math.round(item.caloriesSnapshot)} cal
                                </p>
                                <p className="font-jakarta tabular-nums" style={{ fontSize: 13, color: "#9A897B" }}>
                                  {Math.round(item.proteinSnapshot)}g
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Add meal button */}
      <div className="px-5 pb-10 pt-3">
        <Link href={`/meal/new?date=${date}&returnTo=${encodeURIComponent(returnTo)}`}>
          <button
            className="w-full flex items-center justify-center text-white font-fredoka font-semibold"
            style={{ background: "linear-gradient(135deg, #FF9446, #FF6A12)", borderRadius: 20, fontSize: 19, paddingTop: 20, paddingBottom: 20, boxShadow: "0 8px 22px rgba(255,106,18,0.30)" }}
          >
            + Add Meal
          </button>
        </Link>
      </div>
    </main>
  );
}
