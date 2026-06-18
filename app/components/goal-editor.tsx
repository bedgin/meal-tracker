"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Keep value in sync if parent re-renders with new goal (e.g. after navigation)
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
      <div className="flex items-center gap-1 justify-end">
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          className="w-20 text-right text-2xl font-bold text-gray-900 border-b-2 border-blue-500 bg-transparent outline-none"
          placeholder="—"
        />
        {type === "protein" && (
          <span className="text-base font-medium text-gray-400">g</span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-right group"
      title="Tap to edit goal"
    >
      {currentGoal !== null ? (
        <span className="text-2xl font-bold text-gray-900 group-hover:text-blue-600">
          {Math.round(currentGoal).toLocaleString()}
          {type === "protein" && (
            <span className="text-base font-medium text-gray-400">g</span>
          )}
        </span>
      ) : (
        <span className="text-sm font-medium text-blue-500 group-hover:text-blue-700">
          Set goal
        </span>
      )}
    </button>
  );
}
