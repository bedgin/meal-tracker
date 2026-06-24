"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Ingredient, Recipe, RecipeIngredient } from "@prisma/client";
import { createRecipe, updateRecipe, deleteRecipe } from "@/app/actions/recipes";
import { calcRecipeNutrition } from "@/lib/nutrition";

// ─── Types ───────────────────────────────────────────────────────────────────

type FullRecipe = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
};

type IngredientRow = {
  tempId: string;
  ingredient: Ingredient;
  amountMeasure: number | null;
  measureUnit: string | null;
  amountWeight: number | null;
  weightUnit: string | null;
};

type Props = {
  recipe?: FullRecipe;
  allIngredients: Ingredient[];
  returnTo: string;
};

// ─── Draft helpers (preserves state when navigating to add a new ingredient) ─

const DRAFT_KEY = "recipe-new-draft";

type DraftRow = {
  ingredientId: string;
  amountMeasure: number | null;
  measureUnit: string | null;
  amountWeight: number | null;
  weightUnit: string | null;
};

type Draft = {
  name: string;
  servings: number;
  instructions: string;
  isFavorite: boolean;
  rows: DraftRow[];
};

function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {}
}

function popDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    localStorage.removeItem(DRAFT_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Volume → mL and weight → g tables for cross-unit derivation
const VOL_TO_ML: Record<string, number> = { cup: 236.588, tbsp: 14.787, tsp: 4.929 };
const WEIGHT_TO_G: Record<string, number> = { g: 1, oz: 28.3495, lb: 453.592 };

/**
 * Show the recipe ingredient amount in the chosen display mode.
 *
 * If the stored value for that mode is missing, we try to derive it from the
 * ingredient's defined serving size using a simple ratio:
 *   derivedWeight = (recipeAmount / servingAmount) × servingWeight
 * Units are normalised through mL / g so cross-unit pairs work
 * (e.g. recipe in tbsp, serving defined in cups).
 */
function formatRowAmount(row: IngredientRow, mode: "measure" | "weight"): string {
  const ing = row.ingredient;

  if (mode === "measure") {
    // Prefer stored measure
    if (row.amountMeasure != null && row.measureUnit)
      return `${row.amountMeasure} ${row.measureUnit}`;

    // Derive measure from stored weight using ingredient serving ratio
    if (
      row.amountWeight != null && row.weightUnit &&
      ing.servingWeightAmount && ing.servingWeightUnit &&
      ing.servingMeasureAmount && ing.servingMeasureUnit
    ) {
      const recipeG = row.amountWeight * (WEIGHT_TO_G[row.weightUnit] ?? 1);
      const servingG = ing.servingWeightAmount * (WEIGHT_TO_G[ing.servingWeightUnit] ?? 1);
      const servingMl = ing.servingMeasureAmount * (VOL_TO_ML[ing.servingMeasureUnit] ?? 1);
      const derivedMl = (recipeG / servingG) * servingMl;
      const derivedAmt = derivedMl / (VOL_TO_ML[ing.servingMeasureUnit] ?? 1);
      return `${+derivedAmt.toFixed(2)} ${ing.servingMeasureUnit}`;
    }

    // Last resort: show whatever is stored
    if (row.amountWeight != null && row.weightUnit)
      return `${row.amountWeight} ${row.weightUnit}`;
    return "—";
  } else {
    // Prefer stored weight
    if (row.amountWeight != null && row.weightUnit)
      return `${row.amountWeight} ${row.weightUnit}`;

    // Derive weight from stored measure using ingredient serving ratio
    if (
      row.amountMeasure != null && row.measureUnit &&
      ing.servingMeasureAmount && ing.servingMeasureUnit &&
      ing.servingWeightAmount && ing.servingWeightUnit
    ) {
      const recipeMl = row.amountMeasure * (VOL_TO_ML[row.measureUnit] ?? 1);
      const servingMl = ing.servingMeasureAmount * (VOL_TO_ML[ing.servingMeasureUnit] ?? 1);
      const servingG = ing.servingWeightAmount * (WEIGHT_TO_G[ing.servingWeightUnit] ?? 1);
      const derivedG = (recipeMl / servingMl) * servingG;
      const derivedAmt = derivedG / (WEIGHT_TO_G[ing.servingWeightUnit] ?? 1);
      return `${+derivedAmt.toFixed(1)} ${ing.servingWeightUnit}`;
    }

    // Last resort: show whatever is stored
    if (row.amountMeasure != null && row.measureUnit)
      return `${row.amountMeasure} ${row.measureUnit}`;
    return "—";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RecipeForm({ recipe, allIngredients, returnTo }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!recipe;

  // Form fields
  const [name, setName] = useState(recipe?.name ?? "");
  const [servings, setServings] = useState(recipe?.servings ?? 1);
  const [instructions, setInstructions] = useState(recipe?.instructions ?? "");
  const [isFavorite, setIsFavorite] = useState(recipe?.isFavorite ?? false);

  // Ingredient rows
  const [rows, setRows] = useState<IngredientRow[]>(() =>
    recipe
      ? recipe.ingredients.map((ri) => ({
          tempId: ri.id,
          ingredient: ri.ingredient,
          amountMeasure: ri.amountMeasure,
          measureUnit: ri.measureUnit,
          amountWeight: ri.amountWeight,
          weightUnit: ri.weightUnit,
        }))
      : []
  );

  // Restore draft on mount (new recipe only)
  useEffect(() => {
    if (isEditing) return;
    const draft = popDraft();
    if (!draft) return;
    setName(draft.name);
    setServings(draft.servings);
    setInstructions(draft.instructions);
    setIsFavorite(draft.isFavorite);
    const ingMap = new Map(allIngredients.map((i) => [i.id, i]));
    setRows(
      draft.rows
        .map((r) => {
          const ing = ingMap.get(r.ingredientId);
          return ing
            ? {
                tempId: Math.random().toString(36).slice(2),
                ingredient: ing,
                amountMeasure: r.amountMeasure,
                measureUnit: r.measureUnit,
                amountWeight: r.amountWeight,
                weightUnit: r.weightUnit,
              }
            : null;
        })
        .filter(Boolean) as IngredientRow[]
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Picker state ──────────────────────────────────────────────────────────

  const [showPicker, setShowPicker] = useState(false);
  const [pickerStep, setPickerStep] = useState<"select" | "amount">("select");
  const [pickerSearch, setPickerSearch] = useState("");
  const [selectedIng, setSelectedIng] = useState<Ingredient | null>(null);
  const [pickerMeasureAmt, setPickerMeasureAmt] = useState("");
  const [pickerMeasureUnit, setPickerMeasureUnit] = useState("cups");
  const [pickerWeightAmt, setPickerWeightAmt] = useState("");
  const [pickerWeightUnit, setPickerWeightUnit] = useState("g");

  // ─── UI state ──────────────────────────────────────────────────────────────

  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [displayMode, setDisplayMode] = useState<"measure" | "weight">("measure");

  // ─── Derived ───────────────────────────────────────────────────────────────

  const filteredIngredients = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    return q
      ? allIngredients.filter((i) => i.name.toLowerCase().includes(q))
      : allIngredients;
  }, [pickerSearch, allIngredients]);

  const nutrition = useMemo(
    () =>
      calcRecipeNutrition(
        rows.map((r) => ({
          amountMeasure: r.amountMeasure,
          measureUnit: r.measureUnit,
          amountWeight: r.amountWeight,
          weightUnit: r.weightUnit,
          ingredient: r.ingredient,
        })),
        servings
      ),
    [rows, servings]
  );

  // ─── Picker handlers ───────────────────────────────────────────────────────

  function openPicker() {
    setPickerStep("select");
    setPickerSearch("");
    setSelectedIng(null);
    setPickerMeasureAmt("");
    setPickerMeasureUnit("cups");
    setPickerWeightAmt("");
    setPickerWeightUnit("g");
    setShowPicker(true);
  }

  function closePicker() {
    setShowPicker(false);
  }

  function handleSelectIng(ing: Ingredient) {
    setSelectedIng(ing);
    setPickerMeasureUnit(ing.servingMeasureUnit ?? "cups");
    setPickerWeightUnit(ing.servingWeightUnit ?? "g");
    // Pre-fill with this ingredient's defined serving size
    setPickerMeasureAmt(ing.servingMeasureAmount != null ? String(ing.servingMeasureAmount) : "");
    setPickerWeightAmt(ing.servingWeightAmount != null ? String(ing.servingWeightAmount) : "");
    setPickerStep("amount");
  }

  // ─── Amount sync helpers ───────────────────────────────────────────────────
  // When one field changes, derive the other using the ingredient serving ratio.
  // Works for any unit pair as long as both use the same unit system (ratio math).

  function deriveWeight(measureAmt: string) {
    if (!selectedIng) return;
    const num = parseFloat(measureAmt);
    if (isNaN(num) || num <= 0) return;
    const { servingMeasureAmount: sma, servingMeasureUnit: smu,
            servingWeightAmount: swa, servingWeightUnit: swu } = selectedIng;
    if (!sma || !smu || !swa || !swu) return;
    // ratio: how many servings is the entered amount?
    const recipeNorm = num * (VOL_TO_ML[pickerMeasureUnit] ?? 1);
    const servingNorm = sma * (VOL_TO_ML[smu] ?? 1);
    const ratio = recipeNorm / servingNorm;
    const derivedG = ratio * swa * (WEIGHT_TO_G[swu] ?? 1);
    const derivedAmt = derivedG / (WEIGHT_TO_G[pickerWeightUnit] ?? 1);
    setPickerWeightAmt(String(+derivedAmt.toFixed(1)));
  }

  function deriveMeasure(weightAmt: string) {
    if (!selectedIng) return;
    const num = parseFloat(weightAmt);
    if (isNaN(num) || num <= 0) return;
    const { servingMeasureAmount: sma, servingMeasureUnit: smu,
            servingWeightAmount: swa, servingWeightUnit: swu } = selectedIng;
    if (!sma || !smu || !swa || !swu) return;
    const recipeNorm = num * (WEIGHT_TO_G[pickerWeightUnit] ?? 1);
    const servingNorm = swa * (WEIGHT_TO_G[swu] ?? 1);
    const ratio = recipeNorm / servingNorm;
    const derivedMl = ratio * sma * (VOL_TO_ML[smu] ?? 1);
    const derivedAmt = derivedMl / (VOL_TO_ML[pickerMeasureUnit] ?? 1);
    setPickerMeasureAmt(String(+derivedAmt.toFixed(2)));
  }

  function handleAddToList() {
    if (!selectedIng || (!pickerMeasureAmt && !pickerWeightAmt)) return;
    setRows((prev) => [
      ...prev,
      {
        tempId: Math.random().toString(36).slice(2),
        ingredient: selectedIng,
        amountMeasure: pickerMeasureAmt ? parseFloat(pickerMeasureAmt) : null,
        measureUnit: pickerMeasureAmt ? pickerMeasureUnit : null,
        amountWeight: pickerWeightAmt ? parseFloat(pickerWeightAmt) : null,
        weightUnit: pickerWeightAmt ? pickerWeightUnit : null,
      },
    ]);
    closePicker();
  }

  function handleAddNewIngredient() {
    // Preserve current form state before navigating away
    saveDraft({ name, servings, instructions, isFavorite, rows: rows.map((r) => ({
      ingredientId: r.ingredient.id,
      amountMeasure: r.amountMeasure,
      measureUnit: r.measureUnit,
      amountWeight: r.amountWeight,
      weightUnit: r.weightUnit,
    })) });
    const backTo = isEditing ? `/recipe/${recipe!.id}/edit` : "/recipe/new";
    router.push(`/ingredient/new?returnTo=${encodeURIComponent(backTo)}`);
  }

  // ─── Save / Delete ─────────────────────────────────────────────────────────

  function handleSave() {
    if (!name.trim()) { setError("Recipe name is required."); return; }
    if (rows.length === 0) { setError("Add at least one ingredient."); return; }
    setError(null);

    startTransition(async () => {
      const data = {
        name: name.trim(),
        servings,
        instructions: instructions.trim() || null,
        isFavorite,
        ingredients: rows.map((r) => ({
          ingredientId: r.ingredient.id,
          amountMeasure: r.amountMeasure,
          measureUnit: r.measureUnit,
          amountWeight: r.amountWeight,
          weightUnit: r.weightUnit,
        })),
      };
      if (isEditing) {
        await updateRecipe(recipe.id, data);
      } else {
        await createRecipe(data);
        try { localStorage.removeItem(DRAFT_KEY); } catch {}
      }
      router.push(returnTo);
    });
  }

  function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    startTransition(async () => {
      const result = await deleteRecipe(recipe!.id);
      if (result?.error) {
        setError(result.error);
        setDeleteConfirm(false);
      } else {
        router.push(returnTo);
      }
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────


  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <main className="min-h-screen bg-gray-50 max-w-lg mx-auto flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <Link href={returnTo} className="text-blue-600 font-medium text-sm shrink-0">
            ← Back
          </Link>
          <h1 className="text-base font-semibold text-gray-900 flex-1 truncate">
            {isEditing ? "Edit Recipe" : "Add Recipe"}
          </h1>
          <button
            onClick={() => setIsFavorite((f) => !f)}
            className="text-2xl shrink-0 leading-none"
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? "★" : "☆"}
          </button>
        </header>

        <div className="flex-1 px-4 py-5 space-y-5 pb-4">
          {/* Recipe name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Recipe Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chicken stir fry"
              className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Ingredients list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Ingredients
              </label>
              {rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDisplayMode((m) => m === "measure" ? "weight" : "measure")}
                  className="text-xs font-medium text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1"
                >
                  {displayMode === "measure" ? "Show weight" : "Show measure"}
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {rows.map((row) => (
                <div key={row.tempId} className="flex items-center px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {row.ingredient.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatRowAmount(row, displayMode)}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setRows((prev) => prev.filter((r) => r.tempId !== row.tempId))
                    }
                    className="text-gray-300 hover:text-red-400 text-xl leading-none shrink-0 px-1"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Inline Add row — always visible at the bottom */}
              <button
                type="button"
                onClick={openPicker}
                className="w-full flex items-center gap-3 px-4 py-3 text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors"
              >
                <span className="text-lg leading-none font-light">+</span>
                <span className="text-sm font-medium">Add ingredient</span>
              </button>
            </div>
          </div>

          {/* Servings */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Number of Servings
            </label>
            <select
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "serving" : "servings"}
                </option>
              ))}
            </select>
          </div>

          {/* Live nutrition estimate */}
          {rows.length > 0 && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-end gap-8">
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                  Cal / serving
                </p>
                <p className="text-3xl font-bold text-blue-700 mt-0.5 tabular-nums">
                  {Math.round(nutrition.caloriesPerServing)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                  Protein / serving
                </p>
                <p className="text-3xl font-bold text-blue-700 mt-0.5 tabular-nums">
                  {Math.round(nutrition.proteinPerServing)}
                  <span className="text-lg font-medium">g</span>
                </p>
              </div>
              <p className="text-xs text-blue-300 ml-auto self-start mt-1">estimate</p>
            </div>
          )}

          {/* Instructions */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Instructions{" "}
              <span className="text-gray-300 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Steps, cooking tips, notes…"
              rows={5}
              className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          </div>

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
            {isPending ? "Saving…" : isEditing ? "Save Changes" : "Save Recipe"}
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
              {deleteConfirm ? "Tap again to confirm delete" : "Delete Recipe"}
            </button>
          )}
        </div>
      </main>

      {/* ─── Ingredient Picker Modal ─── */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) closePicker(); }}
        >
          <div className="bg-white rounded-t-2xl flex flex-col max-h-[85vh] max-w-lg mx-auto w-full">
            {/* Modal header */}
            <div className="px-4 py-3 flex items-center border-b border-gray-100 shrink-0">
              {pickerStep === "amount" && (
                <button
                  onClick={() => setPickerStep("select")}
                  className="text-blue-600 text-sm font-medium mr-3 shrink-0"
                >
                  ← Back
                </button>
              )}
              <h2 className="font-semibold text-gray-900 flex-1 truncate text-base">
                {pickerStep === "select" ? "Select Ingredient" : selectedIng?.name}
              </h2>
              <button
                onClick={closePicker}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2 shrink-0"
              >
                ✕
              </button>
            </div>

            {pickerStep === "select" ? (
              <>
                {/* Search */}
                <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search ingredients…"
                    autoFocus
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                  {filteredIngredients.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-10">
                      No ingredients found.
                    </p>
                  ) : (
                    filteredIngredients.map((ing) => (
                      <button
                        key={ing.id}
                        type="button"
                        onClick={() => handleSelectIng(ing)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100"
                      >
                        <span className="text-sm font-medium text-gray-900">
                          {ing.name}
                        </span>
                        {ing.isFavorite && (
                          <span className="ml-1 text-yellow-400 text-xs">★</span>
                        )}
                        <span className="block text-xs text-gray-400 mt-0.5">
                          {ing.caloriesPerServing} cal · {ing.proteinPerServing}g protein
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {/* Add new ingredient */}
                <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                  <button
                    type="button"
                    onClick={handleAddNewIngredient}
                    className="w-full py-3 rounded-xl border border-blue-200 text-blue-600 font-medium text-sm bg-blue-50 hover:bg-blue-100 active:bg-blue-200"
                  >
                    + Add New Ingredient
                  </button>
                </div>
              </>
            ) : (
              /* Amount entry */
              <>
                <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
                  <p className="text-sm text-gray-500">
                    How much <strong className="text-gray-800">{selectedIng?.name}</strong> goes in this recipe? Enter at least one amount.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      By Measurement
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={pickerMeasureAmt}
                        onChange={(e) => {
                          setPickerMeasureAmt(e.target.value);
                          deriveWeight(e.target.value);
                        }}
                        placeholder="Amount"
                        className="flex-1 min-w-0 px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <select
                        value={pickerMeasureUnit}
                        onChange={(e) => setPickerMeasureUnit(e.target.value)}
                        className="px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="cups">Cups</option>
                        <option value="tbsp">Tablespoons</option>
                        <option value="tsp">Teaspoons</option>
                        <option value="scoop">Scoops</option>
                        <option value="items">Items</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      By Weight
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={pickerWeightAmt}
                        onChange={(e) => {
                          setPickerWeightAmt(e.target.value);
                          deriveMeasure(e.target.value);
                        }}
                        placeholder="Amount"
                        className="flex-1 min-w-0 px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <select
                        value={pickerWeightUnit}
                        onChange={(e) => setPickerWeightUnit(e.target.value)}
                        className="px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="g">Grams</option>
                        <option value="oz">Oz</option>
                        <option value="lb">Lbs</option>
                      </select>
                    </div>
                  </div>

                  {!pickerMeasureAmt && !pickerWeightAmt && (
                    <p className="text-xs text-amber-500">
                      Fill in at least one amount above.
                    </p>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                  <button
                    type="button"
                    onClick={handleAddToList}
                    disabled={!pickerMeasureAmt && !pickerWeightAmt}
                    className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add to Recipe
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
