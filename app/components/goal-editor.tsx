"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { setCalorieGoal, setProteinGoal } from "@/app/actions/goals";

export default function GoalEditor({
  date,
  type,
  currentGoal,
}: {
  date: string;
  type: "calorie" | "protein";
  currentGoal: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentGoal?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const accentColor = type === "calorie" ? "#FF7A1A" : "#FF5A6E";

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!editing) setValue(currentGoal?.toString() ?? "");
  }, [currentGoal, editing]);

  function save() {
    const num = parseFloat(value);
    const goal = isNaN(num) || num <= 0 ? null : num;
    startTransition(async () => {
      if (type === "calorie") {
        await setCalorieGoal(date, goal);
      } else {
        await setProteinGoal(date, goal);
      }
      router.refresh();
      setEditing(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") {
      setValue(currentGoal?.toString() ?? "");
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-end gap-1 justify-end">
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          style={{ borderBottomColor: accentColor, color: accentColor }}
          className="w-24 text-right font-fredoka font-medium text-[40px] leading-none border-b-2 bg-transparent outline-none tabular-nums"
          placeholder="—"
        />
        {type === "protein" && (
          <span className="font-fredoka font-medium text-[22px] leading-none mb-0.5" style={{ color: accentColor }}>g</span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-right flex flex-col items-end"
      title="Tap to edit goal"
    >
      <span
        className="font-jakarta font-semibold uppercase flex items-center gap-1 justify-end mb-1"
        style={{ color: "#9A897B", fontSize: 11, letterSpacing: "0.8px" }}
      >
        GOAL <Pencil size={11} strokeWidth={2.5} />
      </span>
      {currentGoal !== null ? (
        <span
          className="font-fredoka font-medium tabular-nums leading-none"
          style={{ color: accentColor, fontSize: 40 }}
        >
          {type === "calorie"
            ? Math.round(currentGoal).toLocaleString()
            : Math.round(currentGoal)}
          {type === "protein" && (
            <span className="font-fredoka font-medium" style={{ fontSize: 22, color: accentColor }}>g</span>
          )}
        </span>
      ) : (
        <span className="text-sm font-jakarta font-medium" style={{ color: accentColor }}>
          Set goal
        </span>
      )}
    </button>
  );
}
