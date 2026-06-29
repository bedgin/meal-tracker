# Future Features

Features we want to build eventually, but aren't ready to tackle yet.

---

## Pending Ideas

<!-- Add features here as they come up -->

### ~~One-Off Meal Entry~~ ✓ Completed
~~Add the ability to log a one-off meal (e.g. a restaurant meal) where you enter calories directly from a menu, without needing a saved food item or recipe.~~

Implemented as "Quick Add" — a button in the Add Meal picker alongside New Food and New Recipe. Accepts a name, calories, and protein. Stored as `itemType: "custom"` on `MealItem` with a `customName` column. Appears in Day Details labeled "Quick Add".

