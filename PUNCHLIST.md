# Punchlist

Small improvements and polish items to address before or after feature completion.

---

- [x] Add eye icon to password fields on sign-in and sign-up screens so users can toggle visibility to see what they are typing.
- [x] The time on the Add Meal screen isn't defaulting to the current quarter hour. For example: If it is currently 1:28, it should set to 1:15. If it is 1:32, it should set to 1:30.
- [x] Add the ability to toggle measure/weight on recipe display.
- [x] On the Add to Meal screen, always show 1 serving size by default. If a recipe has been entered with multiple servings, calculate the macros for that single serving size correctly.
- [x] In the recipe screen, when adding an ingredient to a recipe, calculate and show a single serving size of that ingredient by default.
- [x] When adding items to a meal and navigating away to create a new food, the previously added meal items are lost on return. The meal draft should persist through that process (similar to how the recipe form preserves its draft via localStorage).
