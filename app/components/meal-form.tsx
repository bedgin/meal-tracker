"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Minus, X, Check, Search, Star, ChevronDown } from "lucide-react";
import type { Food, Recipe, Meal, MealItem, Ingredient, RecipeIngredient } from "@prisma/client";
import { calcRecipeNutrition } from "@/lib/nutrition";
import { logMeal, updateMeal, deleteMeal } from "@/app/actions/meals";

// ─── Types ───────────────────────────────────────────────────────────────────

type RecipeWithIngredients = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
};

type FullMeal = Meal & {
  mealItems: (MealItem & { food: Food | null; recipe: (Recipe & { ingredients: unknown[] }) | null })[];
};

type FoodOrRecipe =
  | { kind: "food"; item: Food }
  | { kind: "recipe"; item: RecipeWithIngredients };

type MealRow = {
  tempId: string;
  kind: "food" | "recipe" | "custom";
  itemId: string;
  name: string;
  caloriesPerServing: number;
  proteinPerServing: number;
  servingsMultiplier: number;
};

type Props = {
  meal?: FullMeal;
  foods: Food[];
  recipes: RecipeWithIngredients[];
  defaultDate: string;
  defaultTime?: string;
  defaultMealType: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  returnTo: string;
};

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

// ─── Draft ───────────────────────────────────────────────────────────────────

const DRAFT_KEY = "meal-new-draft";

type DraftRow = {
  kind: "food" | "recipe" | "custom";
  itemId: string;
  name: string;
  caloriesPerServing: number;
  proteinPerServing: number;
  servingsMultiplier: number;
};

type Draft = {
  date: string;
  time: string;
  mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  rows: DraftRow[];
};

function saveDraft(d: Draft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
}

function popDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    localStorage.removeItem(DRAFT_KEY);
    return JSON.parse(raw);
  } catch { return null; }
}

// ─── Unit conversion for food serving derivation ─────────────────────────────

const VOL_TO_ML: Record<string, number> = {
  cup: 236.588, cups: 236.588,
  tbsp: 14.787,
  tsp: 4.929,
};
const WEIGHT_TO_G: Record<string, number> = { g: 1, oz: 28.3495, lb: 453.592 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentQuarterHour(): string {
  const now = new Date();
  const h = now.getHours();
  const m = Math.floor(now.getMinutes() / 15) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeDisplay(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function recipeNutrition(recipe: RecipeWithIngredients) {
  return calcRecipeNutrition(recipe.ingredients, recipe.servings);
}

function buildCatalog(foods: Food[], recipes: RecipeWithIngredients[]): FoodOrRecipe[] {
  const favFoods: FoodOrRecipe[] = foods.filter((f) => f.isFavorite).sort((a, b) => a.name.localeCompare(b.name)).map((f) => ({ kind: "food", item: f }));
  const favRecipes: FoodOrRecipe[] = recipes.filter((r) => r.isFavorite).sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ kind: "recipe", item: r }));
  const restFoods: FoodOrRecipe[] = foods.filter((f) => !f.isFavorite).sort((a, b) => a.name.localeCompare(b.name)).map((f) => ({ kind: "food", item: f }));
  const restRecipes: FoodOrRecipe[] = recipes.filter((r) => !r.isFavorite).sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ kind: "recipe", item: r }));
  return [...favFoods, ...favRecipes, ...restFoods, ...restRecipes];
}

function calPerServing(entry: FoodOrRecipe): number {
  if (entry.kind === "food") return entry.item.caloriesPerServing;
  return recipeNutrition(entry.item).caloriesPerServing;
}

function proteinPerServing(entry: FoodOrRecipe): number {
  if (entry.kind === "food") return entry.item.proteinPerServing;
  return recipeNutrition(entry.item).proteinPerServing;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MealForm({
  meal,
  foods,
  recipes,
  defaultDate,
  defaultTime,
  defaultMealType,
  returnTo,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!meal;

  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(() => {
    if (!defaultTime) return currentQuarterHour();
    if (defaultTime.includes("T")) {
      const d = new Date(defaultTime);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return defaultTime;
  });
  const [mealType, setMealType] = useState(defaultMealType);

  const [rows, setRows] = useState<MealRow[]>(() => {
    if (!meal) return [];
    return meal.mealItems.map((mi) => ({
      tempId: mi.id,
      kind: mi.itemType as "food" | "recipe" | "custom",
      itemId: mi.foodId ?? mi.recipeId ?? "",
      name: mi.food?.name ?? mi.recipe?.name ?? mi.customName ?? "Unknown",
      caloriesPerServing: mi.caloriesSnapshot / mi.servingsMultiplier,
      proteinPerServing: mi.proteinSnapshot / mi.servingsMultiplier,
      servingsMultiplier: mi.servingsMultiplier,
    }));
  });

  useEffect(() => {
    if (isEditing) return;
    const draft = popDraft();
    if (draft) {
      setDate(draft.date);
      setTime(draft.time);
      setMealType(draft.mealType);
      setRows(draft.rows.map((r) => ({
        tempId: Math.random().toString(36).slice(2),
        ...r,
      })));
    } else {
      setShowPicker(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Picker state ──────────────────────────────────────────────────────────

  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FoodOrRecipe | null>(null);
  const [multiplier, setMultiplier] = useState(1);

  // Food-specific amount picker state
  const [pickerMeasureAmt, setPickerMeasureAmt] = useState("");
  const [pickerMeasureUnit, setPickerMeasureUnit] = useState("cups");
  const [pickerWeightAmt, setPickerWeightAmt] = useState("");
  const [pickerWeightUnit, setPickerWeightUnit] = useState("g");

  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Quick Add state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickCal, setQuickCal] = useState("");
  const [quickProtein, setQuickProtein] = useState("");

  const catalog = useMemo(() => buildCatalog(foods, recipes), [foods, recipes]);
  const hasFavorites = catalog.some((e) => e.item.isFavorite);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? catalog.filter((e) => e.item.name.toLowerCase().includes(q)) : catalog;
  }, [search, catalog]);

  const filteredFavCount = useMemo(
    () => (search ? 0 : filtered.filter((e) => e.item.isFavorite).length),
    [search, filtered]
  );

  const totals = useMemo(() =>
    rows.reduce((acc, r) => ({
      cal: acc.cal + r.caloriesPerServing * r.servingsMultiplier,
      protein: acc.protein + r.proteinPerServing * r.servingsMultiplier,
    }), { cal: 0, protein: 0 }),
    [rows]
  );

  function openPicker() {
    setSearch("");
    setSelected(null);
    setMultiplier(1);
    setPickerMeasureAmt("");
    setPickerMeasureUnit("cups");
    setPickerWeightAmt("");
    setPickerWeightUnit("g");
    setShowQuickAdd(false);
    setShowPicker(true);
  }

  function closePicker() {
    setShowPicker(false);
    setSelected(null);
    setShowQuickAdd(false);
  }

  function openQuickAdd() {
    setSelected(null);
    setQuickName("");
    setQuickCal("");
    setQuickProtein("");
    setShowQuickAdd(true);
  }

  function handleAddQuickItem() {
    const cal = parseFloat(quickCal);
    const protein = parseFloat(quickProtein);
    if (!quickName.trim() || isNaN(cal) || cal < 0) return;
    setRows((prev) => [
      ...prev,
      {
        tempId: Math.random().toString(36).slice(2),
        kind: "custom",
        itemId: "",
        name: quickName.trim(),
        caloriesPerServing: cal,
        proteinPerServing: isNaN(protein) ? 0 : protein,
        servingsMultiplier: 1,
      },
    ]);
    setShowQuickAdd(false);
    setShowPicker(false);
  }

  function handleSelect(entry: FoodOrRecipe) {
    setSelected(entry);
    if (entry.kind === "food") {
      const f = entry.item;
      setPickerMeasureAmt(f.servingMeasureAmount != null ? String(f.servingMeasureAmount) : "");
      setPickerMeasureUnit(f.servingMeasureUnit ?? "cups");
      setPickerWeightAmt(f.servingWeightAmount != null ? String(f.servingWeightAmount) : "");
      setPickerWeightUnit(f.servingWeightUnit ?? "g");
    } else {
      setMultiplier(1);
    }
  }

  function deriveWeightForFood(food: Food, measureAmt: string, measureUnit?: string) {
    const num = parseFloat(measureAmt);
    if (isNaN(num) || num <= 0) return;
    if (!food.servingMeasureAmount || !food.servingMeasureUnit || !food.servingWeightAmount || !food.servingWeightUnit) return;
    const unit = measureUnit ?? pickerMeasureUnit;
    const servingNorm = food.servingMeasureAmount * (VOL_TO_ML[food.servingMeasureUnit] ?? 1);
    if (!servingNorm) return;
    const ratio = (num * (VOL_TO_ML[unit] ?? 1)) / servingNorm;
    const derivedG = ratio * food.servingWeightAmount * (WEIGHT_TO_G[food.servingWeightUnit] ?? 1);
    setPickerWeightAmt(String(+(derivedG / (WEIGHT_TO_G[pickerWeightUnit] ?? 1)).toFixed(1)));
  }

  function deriveMeasureForFood(food: Food, weightAmt: string, weightUnit?: string) {
    const num = parseFloat(weightAmt);
    if (isNaN(num) || num <= 0) return;
    if (!food.servingMeasureAmount || !food.servingMeasureUnit || !food.servingWeightAmount || !food.servingWeightUnit) return;
    const unit = weightUnit ?? pickerWeightUnit;
    const servingNorm = food.servingWeightAmount * (WEIGHT_TO_G[food.servingWeightUnit] ?? 1);
    if (!servingNorm) return;
    const ratio = (num * (WEIGHT_TO_G[unit] ?? 1)) / servingNorm;
    const derivedMl = ratio * food.servingMeasureAmount * (VOL_TO_ML[food.servingMeasureUnit] ?? 1);
    setPickerMeasureAmt(String(+(derivedMl / (VOL_TO_ML[pickerMeasureUnit] ?? 1)).toFixed(2)));
  }

  const pickerFoodNutrition = useMemo(() => {
    if (!selected || selected.kind !== "food") return null;
    const food = selected.item;
    const measureNum = parseFloat(pickerMeasureAmt);
    const weightNum = parseFloat(pickerWeightAmt);
    let mult = 0;

    if (measureNum > 0 && food.servingMeasureAmount && food.servingMeasureUnit) {
      const servingNorm = food.servingMeasureAmount * (VOL_TO_ML[food.servingMeasureUnit] ?? 1);
      if (servingNorm) mult = (measureNum * (VOL_TO_ML[pickerMeasureUnit] ?? 1)) / servingNorm;
    }
    if (!mult && weightNum > 0 && food.servingWeightAmount && food.servingWeightUnit) {
      const servingNorm = food.servingWeightAmount * (WEIGHT_TO_G[food.servingWeightUnit] ?? 1);
      if (servingNorm) mult = (weightNum * (WEIGHT_TO_G[pickerWeightUnit] ?? 1)) / servingNorm;
    }

    if (mult <= 0) return null;
    return {
      calories: Math.round(mult * food.caloriesPerServing),
      protein: Math.round(mult * food.proteinPerServing),
      multiplier: mult,
    };
  }, [selected, pickerMeasureAmt, pickerMeasureUnit, pickerWeightAmt, pickerWeightUnit]);

  function handleAddToMeal() {
    if (!selected) return;
    const finalMultiplier = selected.kind === "food"
      ? (pickerFoodNutrition?.multiplier ?? 1)
      : multiplier;

    setRows((prev) => [
      ...prev,
      {
        tempId: Math.random().toString(36).slice(2),
        kind: selected.kind,
        itemId: selected.item.id,
        name: selected.item.name,
        caloriesPerServing: calPerServing(selected),
        proteinPerServing: proteinPerServing(selected),
        servingsMultiplier: finalMultiplier,
      },
    ]);
    setSelected(null);
    setMultiplier(1);
    setSearch("");
    setShowPicker(false);
  }

  function removeRow(tempId: string) {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
  }

  function navigateWithDraft(href: string) {
    saveDraft({
      date,
      time,
      mealType,
      rows: rows.map((r) => ({
        kind: r.kind,
        itemId: r.itemId,
        name: r.name,
        caloriesPerServing: r.caloriesPerServing,
        proteinPerServing: r.proteinPerServing,
        servingsMultiplier: r.servingsMultiplier,
      })),
    });
    closePicker();
    router.push(href);
  }

  function handleSave() {
    if (rows.length === 0) { setError("Add at least one food or recipe."); return; }
    setError(null);
    startTransition(async () => {
      const timeIso = new Date(`${date}T${time}:00`).toISOString();
      const data = {
        date,
        time: timeIso,
        mealType: mealType as "Breakfast" | "Lunch" | "Dinner" | "Snack",
        items: rows.map((r) => ({
          itemType: r.kind,
          foodId: r.kind === "food" ? r.itemId : undefined,
          recipeId: r.kind === "recipe" ? r.itemId : undefined,
          customName: r.kind === "custom" ? r.name : undefined,
          customCalories: r.kind === "custom" ? r.caloriesPerServing : undefined,
          customProtein: r.kind === "custom" ? r.proteinPerServing : undefined,
          servingsMultiplier: r.servingsMultiplier,
        })),
      };
      if (isEditing) {
        await updateMeal(meal.id, data);
      } else {
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
        await logMeal(data);
      }
      router.push(returnTo);
    });
  }

  function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    startTransition(async () => {
      await deleteMeal(meal!.id);
      router.push(returnTo);
    });
  }

  const returnToEncoded = encodeURIComponent(`/meal/new?date=${date}&returnTo=${encodeURIComponent(returnTo)}`);

  // ─── Stepper helpers ───────────────────────────────────────────────────────

  function stepDown() {
    setMultiplier((prev) => Math.max(0.5, parseFloat((prev - 0.5).toFixed(1))));
  }
  function stepUp() {
    setMultiplier((prev) => parseFloat((prev + 0.5).toFixed(1)));
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <main
        className="min-h-screen flex flex-col max-w-lg mx-auto"
        style={{ background: "#FFF7F0" }}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-10 px-5 py-3 flex items-center"
          style={{
            background: "#FFF7F0",
            borderBottom: "1px solid rgba(80,40,10,0.08)",
          }}
        >
          <Link
            href={returnTo}
            className="flex items-center gap-1 shrink-0"
            style={{ color: "#FF7A1A" }}
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
            <span className="font-jakarta font-medium text-base">Back</span>
          </Link>
          <h1
            className="font-fredoka font-medium absolute left-0 right-0 text-center pointer-events-none"
            style={{ color: "#2B2018", fontSize: 22 }}
          >
            {isEditing ? "Edit Meal" : "Add Meal"}
          </h1>
        </header>

        {/* Scrolling body */}
        <div className="flex-1 px-5 py-[18px] space-y-4 pb-4">

          {/* Meta card */}
          <div
            style={{
              background: "#fff",
              borderRadius: 22,
              boxShadow: "0 8px 24px rgba(80,40,10,0.08)",
            }}
          >
            {/* Date row */}
            <label
              className="flex items-center px-[22px] py-[17px] cursor-pointer"
              style={{ borderBottom: "1px solid #F2E6DB" }}
            >
              <span
                className="font-jakarta font-semibold shrink-0 w-24"
                style={{ color: "#9A897B", fontSize: 15 }}
              >
                Date
              </span>
              <span className="flex-1 font-jakarta font-medium text-right" style={{ color: "#2B2018", fontSize: 15 }}>
                {formatDateDisplay(date)}
              </span>
              <ChevronDown size={16} strokeWidth={2} color="#B7A597" className="ml-2 shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="sr-only"
              />
            </label>

            {/* Time row */}
            <label
              className="flex items-center px-[22px] py-[17px] cursor-pointer"
              style={{ borderBottom: "1px solid #F2E6DB" }}
            >
              <span
                className="font-jakarta font-semibold shrink-0 w-24"
                style={{ color: "#9A897B", fontSize: 15 }}
              >
                Time
              </span>
              <span className="flex-1 font-jakarta font-medium text-right" style={{ color: "#2B2018", fontSize: 15 }}>
                {formatTimeDisplay(time)}
              </span>
              <ChevronDown size={16} strokeWidth={2} color="#B7A597" className="ml-2 shrink-0" />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="sr-only"
              />
            </label>

            {/* Meal type row */}
            <div className="px-[22px] py-[17px]">
              <span
                className="font-jakarta font-semibold block mb-3"
                style={{ color: "#9A897B", fontSize: 15 }}
              >
                Meal type
              </span>
              <div className="flex gap-[7px]">
                {MEAL_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setMealType(t)}
                    className="flex-1 font-jakarta font-semibold transition-all"
                    style={{
                      fontSize: 13.5,
                      letterSpacing: "-0.2px",
                      paddingTop: 12,
                      paddingBottom: 12,
                      borderRadius: 12,
                      background: mealType === t
                        ? "linear-gradient(135deg, #FF9446, #FF6A12)"
                        : "#fff",
                      color: mealType === t ? "#fff" : "#2B2018",
                      border: mealType === t ? "none" : "1.5px solid rgba(255,122,26,0.22)",
                      boxShadow: mealType === t ? "0 4px 12px rgba(255,106,18,0.25)" : "none",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Items section */}
          <div>
            <p
              className="font-jakarta font-bold uppercase mb-2 px-1"
              style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}
            >
              ITEMS
            </p>

            <div
              style={{
                background: "#fff",
                borderRadius: 22,
                boxShadow: "0 8px 24px rgba(80,40,10,0.08)",
              }}
            >
              {rows.map((row, idx) => (
                <div
                  key={row.tempId}
                  className="flex items-start px-[22px] py-[17px]"
                  style={{
                    borderBottom: idx < rows.length - 1 || true ? "1px solid #F2E6DB" : "none",
                  }}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p
                      className="font-jakarta font-semibold truncate"
                      style={{ color: "#2B2018", fontSize: 16 }}
                    >
                      {row.name}
                    </p>
                    <p
                      className="font-jakarta font-medium mt-0.5"
                      style={{ color: "#9A897B", fontSize: 13 }}
                    >
                      {Math.round(row.caloriesPerServing * row.servingsMultiplier)} cal
                      {" · "}{Math.round(row.proteinPerServing * row.servingsMultiplier)}g protein
                    </p>
                  </div>
                  <button
                    onClick={() => removeRow(row.tempId)}
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "#FBF1E9",
                    }}
                    aria-label="Remove"
                  >
                    <X size={14} strokeWidth={2.5} color="#9A897B" />
                  </button>
                </div>
              ))}

              {/* Add food or recipe row */}
              <button
                type="button"
                onClick={openPicker}
                className="w-full flex items-center gap-2 px-[22px] py-[17px] font-jakarta font-medium"
                style={{ color: "#FF7A1A", fontSize: 15 }}
              >
                <Plus size={18} strokeWidth={2.5} color="#FF7A1A" />
                Add food or recipe
              </button>
            </div>
          </div>

          {/* Totals strip */}
          {rows.length > 0 && (
            <div
              className="flex gap-8 px-[22px] py-4"
              style={{ background: "#FFF1EA", borderRadius: 18 }}
            >
              <div>
                <p
                  className="font-jakarta font-bold uppercase"
                  style={{ color: "#B07A4E", fontSize: 11, letterSpacing: "0.8px" }}
                >
                  TOTAL CAL
                </p>
                <p
                  className="font-fredoka font-medium tabular-nums leading-none mt-1"
                  style={{ color: "#FF7A1A", fontSize: 32 }}
                >
                  {Math.round(totals.cal)}
                </p>
              </div>
              <div>
                <p
                  className="font-jakarta font-bold uppercase"
                  style={{ color: "#B07A4E", fontSize: 11, letterSpacing: "0.8px" }}
                >
                  TOTAL PROTEIN
                </p>
                <p
                  className="font-fredoka font-medium tabular-nums leading-none mt-1"
                  style={{ color: "#FF5A6E", fontSize: 32 }}
                >
                  {Math.round(totals.protein)}
                  <span className="font-fredoka font-medium" style={{ fontSize: 18 }}>g</span>
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="font-jakarta text-sm px-3 py-2 rounded-xl" style={{ color: "#FF5A4E", background: "#FFF1EA" }}>
              {error}
            </p>
          )}
        </div>

        {/* Sticky footer */}
        <div
          className="px-5 pb-10 pt-3"
          style={{ boxShadow: "0 -6px 20px rgba(80,40,10,0.06)", background: "#FFF7F0" }}
        >
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 text-white font-fredoka font-semibold disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #FF9446, #FF6A12)",
              borderRadius: 20,
              fontSize: 19,
              paddingTop: 20,
              paddingBottom: 20,
              boxShadow: "0 8px 22px rgba(255,106,18,0.30)",
            }}
          >
            <Check size={20} strokeWidth={2.5} color="#fff" />
            {isPending ? "Saving…" : isEditing ? "Save Changes" : "Finish Adding Meal"}
          </button>

          {isEditing && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="w-full mt-3 py-3 rounded-xl font-jakarta font-medium text-sm border transition-colors"
              style={
                deleteConfirm
                  ? { background: "#FF5A4E", color: "#fff", border: "none" }
                  : { background: "#fff", color: "#FF5A4E", border: "1.5px solid rgba(255,90,78,0.3)" }
              }
            >
              {deleteConfirm ? "Tap again to confirm delete" : "Delete Meal"}
            </button>
          )}
        </div>
      </main>

      {/* ─── Food / Recipe Picker (bottom sheet) ─── */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(43,32,24,0.42)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closePicker(); }}
        >
          <div
            className="flex flex-col max-w-lg mx-auto w-full"
            style={{
              background: "#fff",
              borderRadius: "28px 28px 0 0",
              boxShadow: "0 -10px 34px rgba(0,0,0,0.14)",
              maxHeight: "90vh",
            }}
          >
            {/* Sheet header */}
            <div
              className="px-5 py-4 flex items-center justify-between shrink-0"
              style={{ borderBottom: "1px solid #F2E6DB" }}
            >
              <h2
                className="font-fredoka font-medium"
                style={{ color: "#2B2018", fontSize: 22 }}
              >
                Find Food or Recipe
              </h2>
              <button
                onClick={closePicker}
                className="flex items-center justify-center"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "#F7EFE7",
                }}
              >
                <X size={16} strokeWidth={2.5} color="#9A897B" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 shrink-0">
              <div
                className="flex items-center gap-2 px-3"
                style={{
                  border: "1.5px solid rgba(255,122,26,0.25)",
                  borderRadius: 14,
                  background: "#FFFCF9",
                  height: 44,
                }}
              >
                <Search size={16} strokeWidth={2} color="#B7A597" className="shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search foods and recipes…"
                  className="flex-1 bg-transparent font-jakarta text-sm focus:outline-none"
                  style={{ color: "#2B2018" }}
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="font-jakarta text-sm text-center py-10" style={{ color: "#B7A597" }}>No results.</p>
              ) : (
                filtered.map((entry, idx) => {
                  const isSelected = selected?.kind === entry.kind && selected?.item.id === entry.item.id;
                  const showSeparator = !search && hasFavorites && filteredFavCount > 0 && idx === filteredFavCount;
                  const entryCalPerServing = calPerServing(entry);
                  const entryProteinPerServing = proteinPerServing(entry);

                  return (
                    <div key={`${entry.kind}-${entry.item.id}`}>
                      {showSeparator && (
                        <div className="flex items-center gap-3 px-5 py-2">
                          <div className="flex-1 h-px" style={{ background: "#EEE2D6" }} />
                          <span
                            className="font-jakarta font-medium uppercase"
                            style={{ color: "#B7A597", fontSize: 11, letterSpacing: "0.6px" }}
                          >
                            All items
                          </span>
                          <div className="flex-1 h-px" style={{ background: "#EEE2D6" }} />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSelect(entry)}
                        className="w-full text-left px-5 py-3 transition-colors"
                        style={{
                          background: isSelected ? "#FFF1EA" : "transparent",
                          borderBottom: `1px solid #F5ECE3`,
                          borderRadius: isSelected ? 14 : 0,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="font-jakarta font-semibold flex-1 truncate"
                            style={{ color: "#2B2018", fontSize: 16 }}
                          >
                            {entry.item.name}
                          </span>
                          {entry.item.isFavorite && (
                            <Star size={14} fill="#FF9E1B" color="#FF9E1B" className="shrink-0" />
                          )}
                        </div>
                        <span
                          className="font-jakarta font-medium block mt-0.5"
                          style={{ color: "#9A897B", fontSize: 13 }}
                        >
                          {Math.round(entryCalPerServing)} cal · {Math.round(entryProteinPerServing)}g protein / serving
                        </span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected item — amount drawer */}
            {selected && (
              <div
                className="shrink-0 px-5 py-4 space-y-3"
                style={{
                  borderTop: "1px solid #F2E6DB",
                  boxShadow: "0 -4px 16px rgba(80,40,10,0.06)",
                }}
              >
                <div className="flex items-center justify-between">
                  <p
                    className="font-jakarta font-semibold truncate flex-1 mr-3"
                    style={{ color: "#2B2018", fontSize: 17 }}
                  >
                    {selected.item.name}
                  </p>
                  <button
                    onClick={() => setSelected(null)}
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 30, height: 30, borderRadius: "50%", background: "#F7EFE7" }}
                  >
                    <X size={14} strokeWidth={2.5} color="#9A897B" />
                  </button>
                </div>

                {selected.kind === "food" ? (
                  <>
                    {/* By Measurement */}
                    <div>
                      <label className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
                        By Measurement
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={pickerMeasureAmt}
                          onChange={(e) => {
                            setPickerMeasureAmt(e.target.value);
                            deriveWeightForFood(selected.item, e.target.value);
                          }}
                          placeholder="Amount"
                          className="flex-1 min-w-0 px-3 py-2.5 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
                          style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
                        />
                        <select
                          value={pickerMeasureUnit}
                          onChange={(e) => {
                            setPickerMeasureUnit(e.target.value);
                            deriveWeightForFood(selected.item, pickerMeasureAmt, e.target.value);
                          }}
                          className="px-3 py-2.5 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
                          style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
                        >
                          <option value="cups">Cups</option>
                          <option value="tbsp">Tablespoons</option>
                          <option value="tsp">Teaspoons</option>
                          <option value="scoop">Scoops</option>
                          <option value="items">Items</option>
                        </select>
                      </div>
                    </div>

                    {/* By Weight */}
                    <div>
                      <label className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
                        By Weight
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={pickerWeightAmt}
                          onChange={(e) => {
                            setPickerWeightAmt(e.target.value);
                            deriveMeasureForFood(selected.item, e.target.value);
                          }}
                          placeholder="Amount"
                          className="flex-1 min-w-0 px-3 py-2.5 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
                          style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
                        />
                        <select
                          value={pickerWeightUnit}
                          onChange={(e) => {
                            setPickerWeightUnit(e.target.value);
                            deriveMeasureForFood(selected.item, pickerWeightAmt, e.target.value);
                          }}
                          className="px-3 py-2.5 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
                          style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
                        >
                          <option value="g">Grams</option>
                          <option value="oz">Oz</option>
                          <option value="lb">Lbs</option>
                        </select>
                      </div>
                    </div>

                    {/* Live cal/protein preview */}
                    {pickerFoodNutrition ? (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "#FFF5EE" }}>
                        <div className="text-center flex-1">
                          <p className="font-fredoka font-semibold" style={{ fontSize: 22, color: "#FF7A1A", lineHeight: 1 }}>
                            {pickerFoodNutrition.calories}
                          </p>
                          <p className="font-jakarta uppercase" style={{ fontSize: 10, color: "#9A897B", letterSpacing: 1 }}>cal</p>
                        </div>
                        <div style={{ width: 1, height: 32, background: "#F2E6DB" }} />
                        <div className="text-center flex-1">
                          <p className="font-fredoka font-semibold" style={{ fontSize: 22, color: "#FF7A1A", lineHeight: 1 }}>
                            {pickerFoodNutrition.protein}g
                          </p>
                          <p className="font-jakarta uppercase" style={{ fontSize: 10, color: "#9A897B", letterSpacing: 1 }}>protein</p>
                        </div>
                      </div>
                    ) : (
                      <p className="font-jakarta text-xs" style={{ color: "#FF9E1B" }}>
                        Fill in at least one amount above.
                      </p>
                    )}
                  </>
                ) : (
                  /* Recipe: servings stepper */
                  <div className="flex items-center gap-3">
                    <span className="font-jakarta font-semibold shrink-0" style={{ color: "#9A897B", fontSize: 15 }}>
                      Servings
                    </span>
                    <div
                      className="flex items-center"
                      style={{ border: "1.5px solid rgba(255,122,26,0.25)", borderRadius: 12, height: 40, overflow: "hidden" }}
                    >
                      <button onClick={stepDown} className="flex items-center justify-center" style={{ width: 40, height: 40, color: "#FF7A1A" }}>
                        <Minus size={16} strokeWidth={2.5} />
                      </button>
                      <span className="font-jakarta font-semibold tabular-nums text-center" style={{ minWidth: 32, color: "#2B2018", fontSize: 15 }}>
                        {multiplier}
                      </span>
                      <button onClick={stepUp} className="flex items-center justify-center" style={{ width: 40, height: 40, color: "#FF7A1A" }}>
                        <Plus size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                    <span className="font-jakarta font-medium" style={{ color: "#9A897B", fontSize: 13 }}>
                      ≈ {Math.round(calPerServing(selected) * multiplier)} cal · {Math.round(proteinPerServing(selected) * multiplier)}g
                    </span>
                  </div>
                )}

                <button
                  onClick={handleAddToMeal}
                  disabled={selected.kind === "food" && !pickerMeasureAmt && !pickerWeightAmt}
                  className="w-full flex items-center justify-center gap-2 text-white font-fredoka font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #FF9446, #FF6A12)",
                    borderRadius: 18,
                    fontSize: 18,
                    paddingTop: 16,
                    paddingBottom: 16,
                    boxShadow: "0 6px 18px rgba(255,106,18,0.28)",
                  }}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Add to Meal
                </button>
              </div>
            )}

            {/* Quick Add form */}
            {showQuickAdd && (
              <div
                className="shrink-0 px-5 py-4 space-y-3"
                style={{ borderTop: "1px solid #F2E6DB", boxShadow: "0 -4px 16px rgba(80,40,10,0.06)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-jakarta font-semibold" style={{ color: "#2B2018", fontSize: 17 }}>Quick Add</p>
                  <button
                    onClick={() => setShowQuickAdd(false)}
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 30, height: 30, borderRadius: "50%", background: "#F7EFE7" }}
                  >
                    <X size={14} strokeWidth={2.5} color="#9A897B" />
                  </button>
                </div>
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="Name (e.g. Chipotle burrito)"
                  className="w-full px-3 py-2.5 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
                  style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={quickCal}
                    onChange={(e) => setQuickCal(e.target.value)}
                    placeholder="Calories"
                    className="flex-1 min-w-0 px-3 py-2.5 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
                    style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={quickProtein}
                    onChange={(e) => setQuickProtein(e.target.value)}
                    placeholder="Protein (g)"
                    className="flex-1 min-w-0 px-3 py-2.5 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
                    style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
                  />
                </div>
                <button
                  onClick={handleAddQuickItem}
                  disabled={!quickName.trim() || !quickCal || parseFloat(quickCal) < 0}
                  className="w-full flex items-center justify-center gap-2 text-white font-fredoka font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #FF9446, #FF6A12)",
                    borderRadius: 18,
                    fontSize: 18,
                    paddingTop: 16,
                    paddingBottom: 16,
                    boxShadow: "0 6px 18px rgba(255,106,18,0.28)",
                  }}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Add to Meal
                </button>
              </div>
            )}

            {/* Quick links footer */}
            <div
              className="px-5 py-3 shrink-0 grid grid-cols-3 gap-2"
              style={{ borderTop: showQuickAdd ? "none" : "1px solid #F2E6DB" }}
            >
              <button
                type="button"
                onClick={() => navigateWithDraft(`/food/new?returnTo=${returnToEncoded}`)}
                className="flex items-center justify-center py-3 font-jakarta font-medium text-sm"
                style={{
                  border: "1.5px solid rgba(255,122,26,0.22)",
                  borderRadius: 14,
                  color: "#FF7A1A",
                  background: "#fff",
                }}
              >
                New Food
              </button>
              <button
                type="button"
                onClick={() => navigateWithDraft(`/recipe/new?returnTo=${returnToEncoded}`)}
                className="flex items-center justify-center py-3 font-jakarta font-medium text-sm"
                style={{
                  border: "1.5px solid rgba(255,122,26,0.22)",
                  borderRadius: 14,
                  color: "#FF7A1A",
                  background: "#fff",
                }}
              >
                New Recipe
              </button>
              <button
                type="button"
                onClick={openQuickAdd}
                className="flex items-center justify-center py-3 font-jakarta font-medium text-sm"
                style={{
                  border: showQuickAdd ? "1.5px solid #FF7A1A" : "1.5px solid rgba(255,122,26,0.22)",
                  borderRadius: 14,
                  color: "#FF7A1A",
                  background: showQuickAdd ? "#FFF1EA" : "#fff",
                }}
              >
                Quick Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
