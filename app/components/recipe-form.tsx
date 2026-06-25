"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Ingredient, Recipe, RecipeIngredient } from "@prisma/client";
import { createRecipe, updateRecipe, deleteRecipe } from "@/app/actions/recipes";
import { calcRecipeNutrition } from "@/lib/nutrition";
import { ArrowLeft, Star, Search, X, Plus } from "lucide-react";

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
      <main className="min-h-screen max-w-lg mx-auto flex flex-col" style={{ background: "#FFF7F0" }}>
        {/* Header */}
        <header className="sticky top-0 z-10 px-5 py-3 flex items-center" style={{ background: "#FFF7F0", borderBottom: "1px solid rgba(80,40,10,0.08)" }}>
          <Link href={returnTo} className="flex items-center gap-1 shrink-0" style={{ color: "#FF7A1A" }}>
            <ArrowLeft size={18} strokeWidth={2.5} />
            <span className="font-jakarta font-medium text-base">Back</span>
          </Link>
          <h1 className="font-fredoka font-medium absolute left-0 right-0 text-center pointer-events-none" style={{ color: "#2B2018", fontSize: 22 }}>
            {isEditing ? "Edit Recipe" : "Add Recipe"}
          </h1>
          <div className="ml-auto">
            <button
              onClick={() => setIsFavorite((f) => !f)}
              className="flex items-center justify-center shrink-0"
              style={{ width: 44, height: 44, borderRadius: "50%", background: "#FBF1E9" }}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star
                size={20}
                fill={isFavorite ? "#FF9E1B" : "none"}
                color={isFavorite ? "#FF9E1B" : "#D4C4B8"}
                strokeWidth={1.5}
              />
            </button>
          </div>
        </header>

        <div className="flex-1 px-5 py-5 space-y-5 pb-4">
          {/* Recipe name */}
          <div>
            <label className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
              Recipe Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chicken stir fry"
              className="w-full px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
              style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
            />
          </div>

          {/* Ingredients list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-jakarta font-bold uppercase" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
                Ingredients
              </label>
              {rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDisplayMode((m) => m === "measure" ? "weight" : "measure")}
                  className="font-jakarta text-xs px-2 py-1"
                  style={{ border: "1.5px solid rgba(255,122,26,0.22)", color: "#9A897B", borderRadius: 8 }}
                >
                  {displayMode === "measure" ? "Show weight" : "Show measure"}
                </button>
              )}
            </div>

            <div className="overflow-hidden" style={{ background: "#fff", borderRadius: 22, boxShadow: "0 8px 24px rgba(80,40,10,0.08)" }}>
              {rows.map((row) => (
                <div key={row.tempId} className="flex items-center px-4 py-3 gap-3" style={{ borderBottom: "1px solid #F5ECE3" }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-jakarta font-semibold truncate" style={{ fontSize: 15, color: "#2B2018" }}>
                      {row.ingredient.name}
                    </p>
                    <p className="font-jakarta mt-0.5" style={{ fontSize: 13, color: "#9A897B" }}>
                      {formatRowAmount(row, displayMode)}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setRows((prev) => prev.filter((r) => r.tempId !== row.tempId))
                    }
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 30, height: 30, borderRadius: "50%", background: "#FBF1E9" }}
                    aria-label="Remove"
                  >
                    <X size={14} style={{ color: "#9A897B" }} />
                  </button>
                </div>
              ))}

              {/* Inline Add row — always visible at the bottom */}
              <button
                type="button"
                onClick={openPicker}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
                style={{ color: "#FF7A1A" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF1EA")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <Plus size={18} strokeWidth={2} />
                <span className="font-jakarta font-medium text-sm">Add ingredient</span>
              </button>
            </div>
          </div>

          {/* Servings */}
          <div>
            <label className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
              Number of Servings
            </label>
            <select
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-full px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
              style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
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
            <div className="px-5 py-4 flex items-end gap-8" style={{ background: "#FFF1EA", borderRadius: 18 }}>
              <div>
                <p className="font-jakarta font-bold uppercase" style={{ color: "#B07A4E", fontSize: 11, letterSpacing: 1 }}>
                  Cal / serving
                </p>
                <p className="font-fredoka tabular-nums mt-0.5" style={{ fontSize: 32, color: "#FF7A1A", lineHeight: 1.1 }}>
                  {Math.round(nutrition.caloriesPerServing)}
                </p>
              </div>
              <div>
                <p className="font-jakarta font-bold uppercase" style={{ color: "#B07A4E", fontSize: 11, letterSpacing: 1 }}>
                  Protein / serving
                </p>
                <p className="font-fredoka tabular-nums mt-0.5" style={{ fontSize: 32, color: "#FF5A6E", lineHeight: 1.1 }}>
                  {Math.round(nutrition.proteinPerServing)}
                  <span className="font-fredoka" style={{ fontSize: 18 }}>g</span>
                </p>
              </div>
              <p className="font-jakarta text-xs ml-auto self-start mt-1" style={{ color: "#B7A597" }}>estimate</p>
            </div>
          )}

          {/* Instructions */}
          <div>
            <label className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
              Instructions{" "}
              <span className="normal-case font-normal" style={{ color: "#B7A597" }}>(optional)</span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Steps, cooking tips, notes…"
              rows={5}
              className="w-full px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta resize-none"
              style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
            />
          </div>

          {error && (
            <p className="font-jakarta text-sm px-3 py-2 rounded-xl" style={{ background: "#FFF1EA", color: "#FF5A4E" }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-10 pt-3 space-y-3" style={{ boxShadow: "0 -6px 20px rgba(80,40,10,0.06)", background: "#FFF7F0" }}>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 text-white font-fredoka font-semibold disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #FF9446, #FF6A12)", borderRadius: 20, fontSize: 19, paddingTop: 20, paddingBottom: 20, boxShadow: "0 8px 22px rgba(255,106,18,0.30)" }}
          >
            {isPending ? "Saving…" : isEditing ? "Save Changes" : "Save Recipe"}
          </button>

          {isEditing && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="w-full py-3 rounded-xl font-jakarta font-medium text-sm border transition-colors"
              style={deleteConfirm ? { background: "#FF5A4E", color: "#fff", border: "none" } : { background: "#fff", color: "#FF5A4E", border: "1.5px solid rgba(255,90,78,0.3)" }}
            >
              {deleteConfirm ? "Tap again to confirm delete" : "Delete Recipe"}
            </button>
          )}
        </div>
      </main>

      {/* ─── Ingredient Picker Modal ─── */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(43,32,24,0.42)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closePicker(); }}
        >
          <div className="flex flex-col h-[85vh] max-w-lg mx-auto w-full" style={{ background: "#fff", borderRadius: "28px 28px 0 0", boxShadow: "0 -10px 34px rgba(0,0,0,0.14)" }}>
            {/* Modal header */}
            <div className="px-5 py-3 flex items-center shrink-0" style={{ borderBottom: "1px solid #F5ECE3" }}>
              {pickerStep === "amount" && (
                <button
                  onClick={() => setPickerStep("select")}
                  className="font-jakarta font-medium text-sm mr-3 shrink-0"
                  style={{ color: "#FF7A1A" }}
                >
                  ← Back
                </button>
              )}
              <h2 className="font-fredoka font-medium flex-1 truncate" style={{ fontSize: 22, color: "#2B2018" }}>
                {pickerStep === "select" ? "Select Ingredient" : selectedIng?.name}
              </h2>
              <button
                onClick={closePicker}
                className="flex items-center justify-center ml-2 shrink-0"
                style={{ width: 34, height: 34, borderRadius: "50%", background: "#F7EFE7" }}
              >
                <X size={16} style={{ color: "#9A897B" }} />
              </button>
            </div>

            {pickerStep === "select" ? (
              <>
                {/* Search */}
                <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid #F5ECE3" }}>
                  <div className="relative flex items-center">
                    <Search size={16} className="absolute left-3 pointer-events-none" style={{ color: "#B7A597" }} />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Search ingredients…"
                      className="w-full pl-9 pr-4 py-2.5 font-jakarta text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]"
                      style={{ border: "1.5px solid rgba(255,122,26,0.25)", borderRadius: 14, background: "#FFFCF9", color: "#2B2018" }}
                    />
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                  {filteredIngredients.length === 0 ? (
                    <p className="font-jakarta text-sm text-center py-10" style={{ color: "#B7A597" }}>
                      No ingredients found.
                    </p>
                  ) : (
                    filteredIngredients.map((ing) => (
                      <button
                        key={ing.id}
                        type="button"
                        onClick={() => handleSelectIng(ing)}
                        className="w-full text-left px-5 py-3"
                        style={{ borderBottom: "1px solid #F5ECE3" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF1EA")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      >
                        <span className="font-jakarta font-semibold" style={{ fontSize: 16, color: "#2B2018" }}>
                          {ing.name}
                        </span>
                        {ing.isFavorite && (
                          <Star size={12} fill="#FF9E1B" color="#FF9E1B" className="inline ml-1 mb-0.5" />
                        )}
                        <span className="block font-jakarta mt-0.5" style={{ fontSize: 13, color: "#9A897B" }}>
                          {ing.caloriesPerServing} cal · {ing.proteinPerServing}g protein
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {/* Add new ingredient */}
                <div className="px-5 py-3 shrink-0" style={{ borderTop: "1px solid #F5ECE3" }}>
                  <button
                    type="button"
                    onClick={handleAddNewIngredient}
                    className="w-full py-3 rounded-xl font-jakarta font-medium text-sm"
                    style={{ border: "1.5px solid rgba(255,122,26,0.22)", color: "#FF7A1A" }}
                  >
                    + Add New Ingredient
                  </button>
                </div>
              </>
            ) : (
              /* Amount entry */
              <>
                <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto">
                  <p className="font-jakarta text-sm" style={{ color: "#9A897B" }}>
                    How much <strong style={{ color: "#2B2018" }}>{selectedIng?.name}</strong> goes in this recipe? Enter at least one amount.
                  </p>

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
                          deriveWeight(e.target.value);
                        }}
                        placeholder="Amount"
                        className="flex-1 min-w-0 px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
                        style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
                      />
                      <select
                        value={pickerMeasureUnit}
                        onChange={(e) => setPickerMeasureUnit(e.target.value)}
                        className="px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
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
                          deriveMeasure(e.target.value);
                        }}
                        placeholder="Amount"
                        className="flex-1 min-w-0 px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
                        style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
                      />
                      <select
                        value={pickerWeightUnit}
                        onChange={(e) => setPickerWeightUnit(e.target.value)}
                        className="px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
                        style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
                      >
                        <option value="g">Grams</option>
                        <option value="oz">Oz</option>
                        <option value="lb">Lbs</option>
                      </select>
                    </div>
                  </div>

                  {!pickerMeasureAmt && !pickerWeightAmt && (
                    <p className="font-jakarta text-xs" style={{ color: "#FF9E1B" }}>
                      Fill in at least one amount above.
                    </p>
                  )}
                </div>

                <div className="px-5 py-3 shrink-0" style={{ borderTop: "1px solid #F5ECE3" }}>
                  <button
                    type="button"
                    onClick={handleAddToList}
                    disabled={!pickerMeasureAmt && !pickerWeightAmt}
                    className="w-full flex items-center justify-center text-white font-fredoka font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #FF9446, #FF6A12)", borderRadius: 20, fontSize: 19, paddingTop: 18, paddingBottom: 18, boxShadow: "0 8px 22px rgba(255,106,18,0.30)" }}
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
