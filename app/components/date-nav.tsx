"use client";

import { useRouter } from "next/navigation";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatLabel(dateStr: string, today: string): string {
  if (dateStr === today) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function DateNav({
  date,
  today,
  light = false,
}: {
  date: string;
  today: string;
  light?: boolean;
}) {
  const router = useRouter();
  const canGoForward = date < today;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => router.push(`/?date=${addDays(date, -1)}`)}
        className={`w-8 h-8 flex items-center justify-center rounded-full text-xl leading-none ${
          light ? "text-white/80 hover:text-white" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
        }`}
        aria-label="Previous day"
      >
        ‹
      </button>

      <span
        className="font-fredoka font-medium select-none text-center"
        style={{ fontSize: 22, minWidth: 180, color: light ? "#fff" : "#2B2018" }}
      >
        {formatLabel(date, today)}
      </span>

      <button
        onClick={() => canGoForward && router.push(`/?date=${addDays(date, 1)}`)}
        disabled={!canGoForward}
        className={`w-8 h-8 flex items-center justify-center rounded-full text-xl leading-none ${
          canGoForward
            ? light ? "text-white/80 hover:text-white" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            : light ? "text-white/25 cursor-default" : "text-gray-200 cursor-default"
        }`}
        aria-label="Next day"
      >
        ›
      </button>
    </div>
  );
}
