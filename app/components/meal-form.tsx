"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  kind: "food" | "recipe";
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
  defaultTime?: string; // omit on new meal — computed client-side
  defaultMealType: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  returnTo: string;
};

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

// ─── Draft (persists meal state when navigating away to add a new food/recipe)

const DRAFT_KEY = "meal-new-draft";

type DraftRow = {
  kind: "food" | "recipe";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentQuarterHour(): string {
  const now = new Date();
  const h = now.getHours();
  const m = Math.floor(now.getMinutes() / 15) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function recipeNutrition(recipe: RecipeWithIngredients) {
  return calcRecipeNutrition(recipe.ingredients, recipe.servings);
}

function buildCatalog(foods: Food[], recipes: RecipeWithIngredients[]): FoodOrRecipe[] {
  const favFoods: FoodOrRecipe[] = foods
    .filter((f) => f.isFavorite)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({ kind: "food", item: f }));

  const favRecipes: FoodOrRecipe[] = recipes
    .filter((r) => r.isFavorite)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({ kind: "recipe", item: r }));

  const restFoods: FoodOrRecipe[] = foods
    .filter((f) => !f.isFavorite)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({ kind: "food", item: f }));

  const restRecipes: FoodOrRecipe[] = recipes
    .filter((r) => !r.isFavorite)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => ({ kind: "recipe", item: r }));

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

  // ─── Form state ────────────────────────────────────────────────────────────

  const [date, setDate] = useState(defaultDate);
  // Compute quarter-hour client-side when no defaultTime provided (new meal).
  // When editing, defaultTime is a UTC ISO string — convert to local HH:MM in the browser.
  const [time, setTime] = useState(() => {
    if (!defaultTime) return currentQuarterHour();
    if (defaultTime.includes("T")) {
      const d = new Date(defaultTime);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return defaultTime;
  });
  const [mealType, setMealType] = useState(defaultMealType);

  // Meal rows — initialise from existing meal if editing
  const [rows, setRows] = useState<MealRow[]>(() => {
    if (!meal) return [];
    return meal.mealItems.map((mi) => {
      const name = mi.food?.name ?? mi.recipe?.name ?? "Unknown";
      return {
        tempId: mi.id,
        kind: mi.itemType as "food" | "recipe",
        itemId: mi.foodId ?? mi.recipeId ?? "",
        name,
        caloriesPerServing: mi.caloriesSnapshot / mi.servingsMultiplier,
        proteinPerServing: mi.proteinSnapshot / mi.servingsMultiplier,
        servingsMultiplier: mi.servingsMultiplier,
      };
    });
  });

  // Restore draft on mount (new meal only); auto-open picker if no draft
  useEffect(() => {
    if (isEditing) return;
    const draft = popDraft();
    if (draft) {
      setDate(draft.date);
      setTime(draft.time);
      setMealType(draft.mealType);
      setRows(
        draft.rows.map((r) => ({
          tempId: Math.random().toString(36).slice(2),
          kind: r.kind,
          itemId: r.itemId,
          name: r.name,
          caloriesPerServing: r.caloriesPerServing,
          proteinPerServing: r.proteinPerServing,
          servingsMultiplier: r.servingsMultiplier,
        }))
      );
    } else {
      setShowPicker(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Picker state ──────────────────────────────────────────────────────────

  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FoodOrRecipe | null>(null);
  const [multiplier, setMultiplier] = useState("1");

  // ─── UI state ──────────────────────────────────────────────────────────────

  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // ─── Catalog ───────────────────────────────────────────────────────────────

  const catalog = useMemo(() => buildCatalog(foods, recipes), [foods, recipes]);
  const hasFavorites = catalog.some((e) => e.item.isFavorite);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q
      ? catalog.filter((e) => e.item.name.toLowerCase().includes(q))
      : catalog;
  }, [search, catalog]);

  const filteredFavCount = useMemo(
    () =>
      search
        ? 0
        : filtered.filter((e) => e.item.isFavorite).length,
    [search, filtered]
  );

  // ─── Totals ────────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        cal: acc.cal + r.caloriesPerServing * r.servingsMultiplier,
        protein: acc.protein + r.proteinPerServing * r.servingsMultiplier,
      }),
      { cal: 0, protein: 0 }
    );
  }, [rows]);

  // ─── Picker actions ────────────────────────────────────────────────────────

  function openPicker() {
    setSearch("");
    setSelected(null);
    setMultiplier("1");
    setShowPicker(true);
  }

  function closePicker() {
    setShowPicker(false);
    setSelected(null);
  }

  function handleSelect(entry: FoodOrRecipe) {
    setSelected(entry);
    setMultiplier("1");
  }

  function handleAddToMeal() {
    if (!selected) return;
    const mult = parseFloat(multiplier) || 1;
    setRows((prev) => [
      ...prev,
      {
        tempId: Math.random().toString(36).slice(2),
        kind: selected.kind,
        itemId: selected.item.id,
        name: selected.item.name,
        caloriesPerServing: calPerServing(selected),
        proteinPerServing: proteinPerServing(selected),
        servingsMultiplier: mult,
      },
    ]);
    setSelected(null);
    setMultiplier("1");
    setSearch("");
    setShowPicker(false);
  }

  function updateMultiplier(tempId: string, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.tempId === tempId
          ? { ...r, servingsMultiplier: parseFloat(value) || 1 }
          : r
      )
    );
  }

  function removeRow(tempId: string) {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
  }

  // Save draft and navigate to a new food/recipe page
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

  // ─── Save / Delete ─────────────────────────────────────────────────────────

  function handleSave() {
    if (rows.length === 0) {
      setError("Add at least one food or recipe.");
      return;
    }
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

  // ─── Render ────────────────────────────────────────────────────────────────

  const returnToEncoded = encodeURIComponent(`/meal/new?date=${date}&returnTo=${encodeURIComponent(returnTo)}`);

  return (
    <>
      <main className="min-h-screen bg-gray-50 max-w-lg mx-auto flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <Link href={returnTo} className="text-blue-600 font-medium text-sm shrink-0">
            ← Back
          </Link>
          <h1 className="text-base font-semibold text-gray-900 flex-1">
            {isEditing ? "Edit Meal" : "Add Meal"}
          </h1>
        </header>

        <div className="flex-1 px-4 py-5 space-y-5 pb-4">
          {/* Date + Time + Meal Type */}
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            <div className="flex items-center px-4 py-3 gap-3">
              <span className="text-sm font-medium text-gray-500 w-20 shrink-0">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 text-sm font-medium text-gray-900 bg-transparent focus:outline-none"
              />
            </div>
            <div className="flex items-center px-4 py-3 gap-3">
              <span className="text-sm font-medium text-gray-500 w-20 shrink-0">Time</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1 text-sm font-medium text-gray-900 bg-transparent focus:outline-none"
              />
            </div>
            <div className="flex items-center px-4 py-3 gap-3">
              <span className="text-sm font-medium text-gray-500 w-20 shrink-0">Type</span>
              <div className="flex gap-2 flex-wrap">
                {MEAL_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setMealType(t)}
                    className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                      mealType === t
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Meal items */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
              Items
            </label>

            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {rows.map((row) => (
                <div key={row.tempId} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {row.name}
                        {row.kind === "recipe" && (
                          <span className="ml-1.5 text-xs text-purple-500 font-normal">recipe</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {Math.round(row.caloriesPerServing * row.servingsMultiplier)} cal
                        · {Math.round(row.proteinPerServing * row.servingsMultiplier)}g protein
                      </p>
                    </div>
                    <button
                      onClick={() => removeRow(row.tempId)}
                      className="text-gray-300 hover:text-red-400 text-xl leading-none shrink-0 px-1 mt-0.5"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>

                </div>
              ))}

              {/* Inline Add row — always visible at the bottom */}
              <button
                type="button"
                onClick={openPicker}
                className="w-full flex items-center gap-3 px-4 py-3 text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors"
              >
                <span className="text-lg leading-none font-light">+</span>
                <span className="text-sm font-medium">Add food or recipe</span>
              </button>
            </div>
          </div>

          {/* Running totals */}
          {rows.length > 0 && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 flex gap-8">
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Total Cal</p>
                <p className="text-2xl font-bold text-blue-700 tabular-nums">
                  {Math.round(totals.cal)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Total Protein</p>
                <p className="text-2xl font-bold text-blue-700 tabular-nums">
                  {Math.round(totals.protein)}
                  <span className="text-base font-medium">g</span>
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-10 pt-2 space-y-3">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60"
          >
            {isPending
              ? "Saving…"
              : isEditing
                ? "Save Changes"
                : "Finish Adding Meal"}
          </button>

          {isEditing && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className={`w-full py-3 rounded-xl font-medium text-sm border transition-colors ${
                deleteConfirm
                  ? "bg-red-600 text-white border-red-600"
                  : "border-red-200 text-red-500 bg-white hover:bg-red-50"
              }`}
            >
              {deleteConfirm ? "Tap again to confirm delete" : "Delete Meal"}
            </button>
          )}
        </div>
      </main>

      {/* ─── Food / Recipe Picker Modal ─── */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) closePicker(); }}
        >
          <div className="bg-white rounded-t-2xl flex flex-col h-[90vh] max-w-lg mx-auto w-full">
            {/* Modal header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="font-semibold text-gray-900 text-base">Find Food or Recipe</h2>
              <button
                onClick={closePicker}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-100 shrink-0">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search foods and recipes…"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No results.</p>
              ) : (
                filtered.map((entry, idx) => {
                  const isSelected =
                    selected?.kind === entry.kind &&
                    selected?.item.id === entry.item.id;

                  const showSeparator =
                    !search &&
                    hasFavorites &&
                    filteredFavCount > 0 &&
                    idx === filteredFavCount;

                  const entryCalPerServing = calPerServing(entry);
                  const entryProteinPerServing = proteinPerServing(entry);

                  return (
                    <div key={`${entry.kind}-${entry.item.id}`}>
                      {showSeparator && (
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-xs text-gray-400 font-medium">All items</span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSelect(entry)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
                          isSelected
                            ? "bg-blue-50"
                            : "hover:bg-gray-50 active:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                            {entry.item.name}
                          </span>
                          {entry.item.isFavorite && (
                            <span className="text-yellow-400 text-xs">★</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 mt-0.5 block">
                          {Math.round(entryCalPerServing)} cal · {Math.round(entryProteinPerServing)}g protein / serving
                        </span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add to meal panel — shown when something is selected */}
            {selected && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-3 shrink-0 bg-white">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800 truncate flex-1 mr-2">
                    {selected.item.name}
                  </p>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-gray-300 hover:text-gray-500 text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-500 shrink-0">Servings:</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0.1"
                    value={multiplier}
                    onChange={(e) => setMultiplier(e.target.value)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">
                    ≈ {Math.round(calPerServing(selected) * (parseFloat(multiplier) || 1))} cal
                    · {Math.round(proteinPerServing(selected) * (parseFloat(multiplier) || 1))}g
                  </span>
                </div>
                <button
                  onClick={handleAddToMeal}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-base hover:bg-blue-700"
                >
                  Add to Meal
                </button>
              </div>
            )}

            {/* Quick links — saves draft before navigating */}
            <div className="px-4 py-3 border-t border-gray-100 shrink-0 flex gap-3">
              <button
                type="button"
                onClick={() => navigateWithDraft(`/food/new?returnTo=${returnToEncoded}`)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm text-center hover:bg-gray-50"
              >
                + New Food
              </button>
              <button
                type="button"
                onClick={() => navigateWithDraft(`/recipe/new?returnTo=${returnToEncoded}`)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 font-medium text-sm text-center hover:bg-gray-50"
              >
                + New Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
