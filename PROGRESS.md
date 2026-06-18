# Meal Tracker — Build Progress

This file tracks what has been built, what is next, and key decisions made.
Update it as work is completed so any new session can pick up where we left off.

---

## Status: Phase 2 — Screens (complete — Phase 3 polish next)

---

## Infrastructure (Complete)

- [x] GitHub repo: https://github.com/bedgin/meal-tracker
- [x] Vercel project linked and deployed: https://meal-tracker-tau-topaz.vercel.app
- [x] Neon Postgres connected (all env vars injected by Vercel integration)
- [x] Prisma schema written with full data model (see `prisma/schema.prisma`)
- [x] Next.js 15.3.9, React 19, TypeScript, Tailwind CSS configured
- [x] `.env.example` documents all required env vars

## Environment Variables (all set in Vercel)

| Variable | Status |
|---|---|
| `POSTGRES_PRISMA_URL` | Set (by Neon integration) |
| `DATABASE_URL_UNPOOLED` | Set (by Neon integration) |
| `NEXTAUTH_SECRET` | Set |
| `NEXTAUTH_URL` | Set (`https://meal-tracker-tau-topaz.vercel.app`) |
| `USDA_API_KEY` | Set |

## Data Model (Complete)

Defined in `prisma/schema.prisma`. Tables:
- `User` — NextAuth user (id, name, email, emailVerified, image)
- `Account`, `Session`, `VerificationToken` — NextAuth adapter tables
- `Ingredient` — user-scoped; servingMeasure + servingWeight + cals/protein + isFavorite
- `Food` — same shape as Ingredient, plus `items` as a measure unit option
- `Recipe` — references Ingredients via `RecipeIngredient` join table; has servings + instructions
- `RecipeIngredient` — amount by measure and/or weight
- `Meal` — date, time, mealType (Breakfast/Lunch/Dinner/Snack)
- `MealItem` — joins Meal to Food or Recipe; stores servingsMultiplier + calorie/protein snapshot
- `Goal` — per user per date; calorieGoal + proteinGoal

**DB not yet migrated** — `prisma db push` has not been run against Neon yet.

---

## Phase 1 — Foundation

- [x] **Auth** — NextAuth v5 setup (sign in, sign up, session, middleware to protect routes)
- [x] **DB migration** — `prisma db push` run; all tables created in Neon
- [x] **Server Actions: Ingredient** — create, read, update, delete, toggle favorite
- [x] **Server Actions: Food** — create, read, update, delete, toggle favorite
- [x] **Server Actions: Recipe** — create, read, update, delete, toggle favorite; nutrition calc via `lib/nutrition.ts`
- [x] **Server Actions: Meal** — log meal (with calorie/protein snapshot), list by date, daily totals, delete
- [x] **Server Actions: Goal** — get/set/effective goal for a date (upsert)
- [x] **USDA lookup** — searches FoodData Central; returns per-100g and per-serving values

## Phase 2 — Screens

- [x] **Main Screen** — date nav (‹ Today ›), calories/protein cards with progress bars, tappable inline goal editing, Add Meal / Add Recipe / Add Food / Add Ingredient / See Details buttons
- [x] **Add Ingredient Screen** — autocomplete from existing ingredients, USDA lookup, serving size (measurement + weight), calories/protein, favorite toggle, two-tap delete guard, edit mode with prefill (`/ingredient/[id]/edit`)
- [x] **Add Food Screen** — same as ingredient form but measure unit dropdown includes Items (for "1 banana", "24 chips", etc.); autocomplete, USDA lookup, favorite, two-tap delete, edit mode
- [x] **Add Recipe Screen** — two-step ingredient picker modal (select → enter amount), live cal/protein estimate, servings 1–12, instructions, favorite toggle, two-tap delete, localStorage draft preserves state when navigating to add a new ingredient, edit mode
- [x] **Add Meal Screen** — food/recipe picker (favorites first with separator), servings multiplier per row, live totals, meal type pills, two-tap delete in edit mode, server actions for log/update/delete
- [x] **Day Details Screen** — `/details?date=YYYY-MM-DD`, meals grouped by Breakfast/Lunch/Dinner/Snack, each card shows items with cal/protein, taps to edit, two-tap delete
- [x] **Library View** — `/library`, tabbed Ingredients/Foods/Recipes with counts, search, star toggle, tap to edit, two-tap delete with error banner for protected items

## Phase 3 — Polish

- [ ] Historical day navigation (tap date on Main Screen)
- [ ] Goal editing inline on Main Screen
- [ ] Meal type auto-default logic (1st=Breakfast, 2nd=Lunch, 3rd=Dinner, rest=Snack)
- [ ] Density lookup table for volume↔weight conversions in recipes
- [ ] Soft-delete protection for ingredients/foods used in recipes or logged meals

---

## Key Decisions

- **Framework**: Next.js 15 App Router + React 19 + TypeScript
- **Styling**: Tailwind CSS (mobile-first)
- **ORM**: Prisma 6 with `POSTGRES_PRISMA_URL` (pooled) + `DATABASE_URL_UNPOOLED` (direct)
- **Auth**: NextAuth v5 (beta) with Prisma adapter
- **Nutrition lookup**: USDA FoodData Central API (key in env vars)
- **Recipe nutrition**: best-effort unit conversion with density approximation table
- **MealItem snapshots**: calories/protein are snapshotted at log time so editing a food later doesn't rewrite history
- **Goals**: stored per user per date so historical days reflect the goal that was active then
- **Favorites**: sort to top of food/recipe picker (alpha within group, separator, then rest alpha)
- **Data privacy**: all data is private per user; nothing shared between accounts

---

## How to Resume in a New Session

1. Read this file and `Meal_Tracker_Spec.md` for full context
2. Check the unchecked boxes above to see what's next
3. Run `vercel env pull .env.local` to get env vars locally if needed
4. All Phase 2 screens are complete. The next task is Phase 3 polish — see the Phase 3 section below.
