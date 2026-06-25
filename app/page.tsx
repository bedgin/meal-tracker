import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, User, ChevronRight, Plus, UtensilsCrossed, Apple, Wheat } from "lucide-react";
import { getDailyTotals } from "@/app/actions/meals";
import { getEffectiveGoalForDate } from "@/app/actions/goals";
import DateNav from "@/app/components/date-nav";
import GoalEditor from "@/app/components/goal-editor";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning 👋";
  if (h < 17) return "Good afternoon 👋";
  return "Good evening 👋";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { date: dateParam } = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const date = dateParam || today;

  const [{ totalCalories, totalProtein }, goal] = await Promise.all([
    getDailyTotals(date),
    getEffectiveGoalForDate(date),
  ]);

  const calorieGoal = goal?.calorieGoal ?? null;
  const proteinGoal = goal?.proteinGoal ?? null;
  const caloriesRemaining = calorieGoal !== null ? calorieGoal - totalCalories : null;
  const proteinRemaining = proteinGoal !== null ? proteinGoal - totalProtein : null;

  const calPct = calorieGoal ? Math.min(100, (totalCalories / calorieGoal) * 100) : 0;
  const proteinPct = proteinGoal ? Math.min(100, (totalProtein / proteinGoal) * 100) : 0;
  const calOver = calorieGoal !== null && totalCalories > calorieGoal;
  const proteinOver = proteinGoal !== null && totalProtein > proteinGoal;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <main
      className="min-h-screen flex flex-col max-w-lg mx-auto"
      style={{ background: "#FFF7F0" }}
    >
      {/* ── Gradient header ── */}
      <header
        style={{
          background: "linear-gradient(150deg, #FFB44D 0%, #FF7A1A 62%, #FF5A4E 122%)",
          padding: "14px 24px 70px",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-white text-sm font-jakarta font-medium">{greeting()}</p>
          <form action={handleSignOut}>
            <button type="submit" className="text-white/70 text-xs font-jakarta hover:text-white">
              Sign out
            </button>
          </form>
        </div>
        <div className="flex items-center justify-between">
          <DateNav date={date} today={today} light />
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/library">
              <button
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.22)" }}
                aria-label="Library"
              >
                <BookOpen size={20} color="#fff" strokeWidth={2} />
              </button>
            </Link>
            <button
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.22)" }}
              aria-label="Account"
            >
              <User size={20} color="#fff" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Metric cards (overlap header) ── */}
      <div className="px-5 space-y-3" style={{ marginTop: -48 }}>

        {/* Calories card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 22,
            boxShadow: "0 8px 24px rgba(80,40,10,0.08)",
            padding: 22,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className="font-jakarta font-bold uppercase"
                style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}
              >
                CALORIES
              </p>
              <p
                className="font-fredoka font-medium tabular-nums leading-none mt-1"
                style={{ color: "#2B2018", fontSize: 40 }}
              >
                {Math.round(totalCalories).toLocaleString()}
              </p>
              <p className="font-jakarta text-xs mt-1" style={{ color: "#9A897B" }}>consumed</p>
            </div>
            <GoalEditor date={date} type="calorie" currentGoal={calorieGoal} />
          </div>

          {calorieGoal && (
            <div
              style={{
                background: "#FFE7D6",
                height: 11,
                borderRadius: 99,
                overflow: "hidden",
                marginTop: 14,
              }}
            >
              <div
                style={{
                  width: `${calPct}%`,
                  height: "100%",
                  background: calOver ? "#FF5A4E" : "linear-gradient(90deg, #FF9446, #FF7A1A)",
                  borderRadius: 99,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          )}

          {caloriesRemaining !== null && (
            <p className="font-jakarta text-sm mt-2 font-medium">
              <span style={{ color: calOver ? "#FF5A4E" : "#FF7A1A" }}>
                {Math.abs(Math.round(caloriesRemaining)).toLocaleString()}
              </span>{" "}
              <span style={{ color: "#9A897B" }}>
                {calOver ? "over goal" : "remaining"}
              </span>
            </p>
          )}
        </div>

        {/* Protein card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 22,
            boxShadow: "0 8px 24px rgba(80,40,10,0.08)",
            padding: 22,
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className="font-jakarta font-bold uppercase"
                style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}
              >
                PROTEIN
              </p>
              <p
                className="font-fredoka font-medium tabular-nums leading-none mt-1"
                style={{ color: "#2B2018", fontSize: 40 }}
              >
                {Math.round(totalProtein)}
                <span className="font-fredoka font-medium" style={{ fontSize: 22, color: "#B7A597" }}>g</span>
              </p>
              <p className="font-jakarta text-xs mt-1" style={{ color: "#9A897B" }}>consumed</p>
            </div>
            <GoalEditor date={date} type="protein" currentGoal={proteinGoal} />
          </div>

          {proteinGoal && (
            <div
              style={{
                background: "#FFE0E4",
                height: 11,
                borderRadius: 99,
                overflow: "hidden",
                marginTop: 14,
              }}
            >
              <div
                style={{
                  width: `${proteinPct}%`,
                  height: "100%",
                  background: proteinOver ? "#FF3A4E" : "linear-gradient(90deg, #FF7E8E, #FF5A6E)",
                  borderRadius: 99,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          )}

          {proteinRemaining !== null && (
            <p className="font-jakarta text-sm mt-2 font-medium">
              <span style={{ color: proteinOver ? "#FF3A4E" : "#FF5A6E" }}>
                {Math.abs(Math.round(proteinRemaining))}g
              </span>{" "}
              <span style={{ color: "#9A897B" }}>
                {proteinOver ? "over goal" : "remaining"}
              </span>
            </p>
          )}
        </div>

        {/* See day details */}
        <Link href={`/details?date=${date}`} className="block">
          <button
            className="w-full flex items-center justify-center gap-1.5 py-3 font-jakarta font-medium text-sm bg-white"
            style={{
              border: "1.5px solid rgba(255,122,26,0.22)",
              borderRadius: 16,
              color: "#FF7A1A",
            }}
          >
            See day details
            <ChevronRight size={16} strokeWidth={2.5} color="#FF7A1A" />
          </button>
        </Link>
      </div>

      {/* ── Bottom action group ── */}
      <div className="mt-auto px-5 pb-7 pt-6 space-y-[10px]">
        <Link href={`/meal/new?date=${date}`} className="block">
          <button
            className="w-full flex items-center justify-center gap-2 text-white font-fredoka font-semibold"
            style={{
              background: "linear-gradient(135deg, #FF9446, #FF6A12)",
              borderRadius: 20,
              fontSize: 19,
              paddingTop: 20,
              paddingBottom: 20,
              boxShadow: "0 8px 22px rgba(255,106,18,0.30)",
            }}
          >
            <Plus size={20} strokeWidth={2.5} color="#fff" />
            Add Meal
          </button>
        </Link>

        <div className="grid grid-cols-3 gap-[10px]">
          {[
            { href: "/recipe/new", label: "Recipe", Icon: UtensilsCrossed },
            { href: "/food/new", label: "Food", Icon: Apple },
            { href: "/ingredient/new", label: "Ingredient", Icon: Wheat },
          ].map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="block">
              <button
                className="w-full flex flex-col items-center justify-center gap-1.5 py-3 bg-white font-jakarta font-medium"
                style={{
                  border: "1.5px solid rgba(255,122,26,0.20)",
                  borderRadius: 16,
                  color: "#9A897B",
                  fontSize: 13,
                }}
              >
                <Icon size={18} strokeWidth={2} color="#FF7A1A" />
                {label}
              </button>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
