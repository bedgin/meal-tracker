"use client";

import { useState, useTransition } from "react";
import { deleteMeal } from "@/app/actions/meals";
import { useRouter } from "next/navigation";

export default function DeleteMealButton({
  mealId,
  date,
}: {
  mealId: string;
  date: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation(); // don't navigate to edit
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    startTransition(async () => {
      await deleteMeal(mealId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        armed
          ? "bg-red-500 text-white"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {pending ? "…" : armed ? "Confirm" : "Delete"}
    </button>
  );
}
