"use client";

import { useRouter } from "next/navigation";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function DateNav({
  date,
  today,
}: {
  date: string;
  today: string;
}) {
  const router = useRouter();
  const canGoForward = date < today;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => router.push(`/?date=${addDays(date, -1)}`)}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 text-xl"
        aria-label="Previous day"
      >
        ‹
      </button>

      <span className="text-sm font-semibold text-gray-800 min-w-[110px] text-center select-none">
        {formatLabel(date, today)}
      </span>

      <button
        onClick={() => canGoForward && router.push(`/?date=${addDays(date, 1)}`)}
        disabled={!canGoForward}
        className={`w-8 h-8 flex items-center justify-center rounded-full text-xl ${
          canGoForward
            ? "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            : "text-gray-200 cursor-default"
        }`}
        aria-label="Next day"
      >
        ›
      </button>
    </div>
  );
}
