-- ============================================================
-- 011_allow_lunch_and_dinner_meal_plan.sql
-- Allow "Lunch & Dinner" as an option for itinerary_days.meal_plan
-- ============================================================

alter table itinerary_days
  drop constraint if exists itinerary_meal_plan_check;

alter table itinerary_days
  add constraint itinerary_meal_plan_check
  check (
    meal_plan is null or meal_plan in (
      'Breakfast',
      'Breakfast & Dinner',
      'Lunch & Dinner',
      'Breakfast, Lunch & Dinner'
    )
  ) not valid;
