"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Ingredient } from "@prisma/client";
import {
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from "@/app/actions/ingredients";
import { searchUsdaFoods, type UsdaResult } from "@/app/actions/usda";
import { ArrowLeft, Star, X } from "lucide-react";

type Props = {
  ingredient?: Ingredient;
  existingIngredients: Ingredient[];
  returnTo: string;
};

export default function IngredientForm({
  ingredient,
  existingIngredients,
  returnTo,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!ingredient;

  // Form fields
  const [name, setName] = useState(ingredient?.name ?? "");
  const [measureAmount, setMeasureAmount] = useState(
    ingredient?.servingMeasureAmount?.toString() ?? ""
  );
  const [measureUnit, setMeasureUnit] = useState(
    ingredient?.servingMeasureUnit ?? "cups"
  );
  const [weightAmount, setWeightAmount] = useState(
    ingredient?.servingWeightAmount?.toString() ?? ""
  );
  const [weightUnit, setWeightUnit] = useState(
    ingredient?.servingWeightUnit ?? "g"
  );
  const [calories, setCalories] = useState(
    ingredient?.caloriesPerServing?.toString() ?? ""
  );
  const [protein, setProtein] = useState(
    ingredient?.proteinPerServing?.toString() ?? ""
  );
  const [isFavorite, setIsFavorite] = useState(ingredient?.isFavorite ?? false);

  // Autocomplete
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [filtered, setFiltered] = useState<Ingredient[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // USDA lookup
  const [usdaResults, setUsdaResults] = useState<UsdaResult[]>([]);
  const [usdaError, setUsdaError] = useState<string | null>(null);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [showUsda, setShowUsda] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Filter autocomplete list when name changes
  useEffect(() => {
    const q = name.toLowerCase().trim();
    setFiltered(
      existingIngredients
        .filter((i) => !q || i.name.toLowerCase().includes(q))
        .slice(0, 8)
    );
  }, [name, existingIngredients]);

  // Close autocomplete on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        !autocompleteRef.current?.contains(e.target as Node) &&
        !nameInputRef.current?.contains(e.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function fillFromIngredient(ing: Ingredient) {
    setName(ing.name);
    setMeasureAmount(ing.servingMeasureAmount?.toString() ?? "");
    setMeasureUnit(ing.servingMeasureUnit ?? "cups");
    setWeightAmount(ing.servingWeightAmount?.toString() ?? "");
    setWeightUnit(ing.servingWeightUnit ?? "g");
    setCalories(ing.caloriesPerServing.toString());
    setProtein(ing.proteinPerServing.toString());
    setIsFavorite(ing.isFavorite);
    setShowAutocomplete(false);
  }

  async function handleUsdaLookup() {
    if (!name.trim()) return;
    setUsdaLoading(true);
    setUsdaError(null);
    setShowUsda(false);

    const { results, error: err } = await searchUsdaFoods(name.trim());
    setUsdaLoading(false);

    if (err) {
      setUsdaError(err);
    } else if (results.length === 0) {
      setUsdaError("No results found. Try a different name.");
    } else {
      setUsdaResults(results);
      setShowUsda(true);
    }
  }

  function fillFromUsda(result: UsdaResult) {
    setName(result.description);
    if (result.caloriesPerServing !== null) {
      setCalories(Math.round(result.caloriesPerServing).toString());
      setProtein((result.proteinPerServing ?? 0).toString());
      if (result.servingSize && result.servingSizeUnit?.toLowerCase() === "g") {
        setWeightAmount(result.servingSize.toString());
        setWeightUnit("g");
      }
    } else if (result.caloriesPer100g !== null) {
      setCalories(Math.round(result.caloriesPer100g).toString());
      setProtein((result.proteinPer100g ?? 0).toString());
      setWeightAmount("100");
      setWeightUnit("g");
    }
    setShowUsda(false);
  }

  function buildData() {
    return {
      name: name.trim(),
      servingMeasureAmount: measureAmount ? parseFloat(measureAmount) : null,
      servingMeasureUnit: measureAmount ? measureUnit : null,
      servingWeightAmount: weightAmount ? parseFloat(weightAmount) : null,
      servingWeightUnit: weightAmount ? weightUnit : null,
      caloriesPerServing: parseFloat(calories) || 0,
      proteinPerServing: parseFloat(protein) || 0,
      isFavorite,
    };
  }

  function validate() {
    if (!name.trim()) return "Name is required.";
    if (calories === "") return "Calories per serving is required.";
    if (protein === "") return "Protein per serving is required.";
    return null;
  }

  function handleSave() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);

    startTransition(async () => {
      const data = buildData();
      if (isEditing) {
        await updateIngredient(ingredient.id, data);
      } else {
        await createIngredient(data);
      }
      router.push(returnTo);
    });
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteIngredient(ingredient!.id);
      if (result?.error) {
        setError(result.error);
        setDeleteConfirm(false);
      } else {
        router.push(returnTo);
      }
    });
  }

  return (
    <main className="min-h-screen max-w-lg mx-auto flex flex-col" style={{ background: "#FFF7F0" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 px-5 py-3 flex items-center" style={{ background: "#FFF7F0", borderBottom: "1px solid rgba(80,40,10,0.08)" }}>
        <Link href={returnTo} className="flex items-center gap-1 shrink-0" style={{ color: "#FF7A1A" }}>
          <ArrowLeft size={18} strokeWidth={2.5} />
          <span className="font-jakarta font-medium text-base">Back</span>
        </Link>
        <h1 className="font-fredoka font-medium absolute left-0 right-0 text-center pointer-events-none" style={{ color: "#2B2018", fontSize: 22 }}>
          {isEditing ? "Edit Ingredient" : "Add Ingredient"}
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
        {/* Name + Autocomplete */}
        <div className="relative">
          <label className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
            Ingredient Name
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setShowAutocomplete(true)}
            placeholder="e.g. Chicken breast"
            className="w-full px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
            style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
          />
          {showAutocomplete && filtered.length > 0 && (
            <div
              ref={autocompleteRef}
              className="absolute left-0 right-0 top-full mt-1 z-20 overflow-hidden max-h-52 overflow-y-auto"
              style={{ background: "#fff", borderRadius: 16, boxShadow: "0 8px 24px rgba(80,40,10,0.08)" }}
            >
              {filtered.map((ing) => (
                <button
                  key={ing.id}
                  type="button"
                  onMouseDown={() => fillFromIngredient(ing)}
                  className="w-full text-left px-4 py-3 last:border-0"
                  style={{ borderBottom: "1px solid #F5ECE3" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF1EA")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <span className="font-jakarta font-semibold" style={{ color: "#2B2018" }}>
                    {ing.name}
                  </span>
                  {ing.isFavorite && (
                    <Star size={12} fill="#FF9E1B" color="#FF9E1B" className="inline ml-1 mb-0.5" />
                  )}
                  <span className="block font-jakarta mt-0.5" style={{ fontSize: 13, color: "#9A897B" }}>
                    {ing.caloriesPerServing} cal · {ing.proteinPerServing}g protein
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* USDA Lookup */}
        <div>
          <button
            type="button"
            onClick={handleUsdaLookup}
            disabled={usdaLoading || !name.trim()}
            className="w-full py-3 font-jakarta font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: "1.5px solid rgba(255,122,26,0.35)", color: "#FF7A1A", background: "#FFF7F0", borderRadius: 14 }}
          >
            {usdaLoading ? "Looking up…" : "Lookup Based on Name"}
          </button>

          {usdaError && (
            <p className="font-jakarta text-sm mt-2 text-center" style={{ color: "#FF5A4E" }}>{usdaError}</p>
          )}

          {showUsda && (
            <div className="mt-2 overflow-hidden" style={{ background: "#fff", borderRadius: 16, boxShadow: "0 8px 24px rgba(80,40,10,0.08)" }}>
              <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid #F5ECE3" }}>
                <p className="font-jakarta font-bold uppercase" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
                  USDA Results — tap to use
                </p>
                <button
                  onClick={() => setShowUsda(false)}
                  className="flex items-center justify-center"
                  style={{ color: "#9A897B" }}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {usdaResults.map((result) => (
                  <button
                    key={result.fdcId}
                    type="button"
                    onClick={() => fillFromUsda(result)}
                    className="w-full text-left px-4 py-3"
                    style={{ borderBottom: "1px solid #F5ECE3" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#FFF1EA")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <p className="font-jakarta font-semibold leading-snug" style={{ color: "#2B2018" }}>
                      {result.description}
                    </p>
                    {result.brandOwner && (
                      <p className="font-jakarta mt-0.5" style={{ fontSize: 13, color: "#9A897B" }}>
                        {result.brandOwner}
                      </p>
                    )}
                    <p className="font-jakarta mt-1" style={{ fontSize: 13, color: "#FF7A1A" }}>
                      {result.caloriesPerServing !== null
                        ? `${Math.round(result.caloriesPerServing)} cal · ${result.proteinPerServing ?? 0}g protein / serving`
                        : result.caloriesPer100g !== null
                          ? `${Math.round(result.caloriesPer100g)} cal · ${result.proteinPer100g ?? 0}g protein / 100g`
                          : "Nutrition info unavailable"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Serving size — measurement */}
        <div>
          <label className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
            Serving Size — Measurement{" "}
            <span className="normal-case font-normal" style={{ color: "#B7A597" }}>(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={measureAmount}
              onChange={(e) => setMeasureAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 min-w-0 px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
              style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
            />
            <select
              value={measureUnit}
              onChange={(e) => setMeasureUnit(e.target.value)}
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

        {/* Serving size — weight */}
        <div>
          <label className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
            Serving Size — Weight{" "}
            <span className="normal-case font-normal" style={{ color: "#B7A597" }}>(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={weightAmount}
              onChange={(e) => setWeightAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 min-w-0 px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
              style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
            />
            <select
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value)}
              className="px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
              style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
            >
              <option value="g">Grams</option>
              <option value="oz">Oz</option>
              <option value="lb">Lbs</option>
            </select>
          </div>
        </div>

        {/* Calories */}
        <div>
          <label className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
            Calories Per Serving
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
            style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
          />
        </div>

        {/* Protein */}
        <div>
          <label className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
            Protein Per Serving (g)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
            style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
          />
        </div>

        {error && (
          <p className="font-jakarta text-sm px-3 py-2 rounded-xl" style={{ background: "#FFF1EA", color: "#FF5A4E" }}>
            {error}
          </p>
        )}
      </div>

      {/* Footer buttons */}
      <div className="px-5 pb-10 pt-3 space-y-3" style={{ boxShadow: "0 -6px 20px rgba(80,40,10,0.06)", background: "#FFF7F0" }}>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 text-white font-fredoka font-semibold disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #FF9446, #FF6A12)", borderRadius: 20, fontSize: 19, paddingTop: 20, paddingBottom: 20, boxShadow: "0 8px 22px rgba(255,106,18,0.30)" }}
        >
          {isPending ? "Saving…" : isEditing ? "Save Changes" : "Save Ingredient"}
        </button>

        {isEditing && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="w-full py-3 rounded-xl font-jakarta font-medium text-sm border transition-colors"
            style={deleteConfirm ? { background: "#FF5A4E", color: "#fff", border: "none" } : { background: "#fff", color: "#FF5A4E", border: "1.5px solid rgba(255,90,78,0.3)" }}
          >
            {deleteConfirm ? "Tap again to confirm delete" : "Delete Ingredient"}
          </button>
        )}
      </div>
    </main>
  );
}
