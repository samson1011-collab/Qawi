import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Alert, ActivityIndicator, Modal, Share,
  KeyboardAvoidingView, Platform, Animated, Easing
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import TextRecognition from "@react-native-ml-kit/text-recognition";

// ─── UNIT CONVERSION ─────────────────────────────────────────────────────────

const UNIT_META = {
  "cup":     { category: "volume", toCup: 1 },
  "fl oz":   { category: "volume", toCup: 0.125 },
  "tbsp":    { category: "volume", toCup: 0.0625 },
  "tsp":     { category: "volume", toCup: 0.020833 },
  "oz":      { category: "weight", toOz: 1 },
  "lb":      { category: "weight", toOz: 16 },
  "g":       { category: "weight", toOz: 0.035274 },
  "kg":      { category: "weight", toOz: 35.274 },
  "piece":   { category: "count" },
  "slice":   { category: "count" },
  "can":     { category: "count" },
  "bottle":  { category: "count" },
  "scoop":   { category: "count" },
  "packet":  { category: "count" },
  "bar":     { category: "count" },
  "serving": { category: "count" },
};

function getConversionFactor(fromUnit, toUnit) {
  if (fromUnit === toUnit) return 1;
  const from = UNIT_META[fromUnit];
  const to = UNIT_META[toUnit];
  if (!from || !to || from.category !== to.category || from.category === "count") return null;
  if (from.category === "volume") return to.toCup / from.toCup;
  if (from.category === "weight") return to.toOz / from.toOz;
  return null;
}

function compatibleUnits(baseUnit) {
  const meta = UNIT_META[baseUnit];
  if (!meta || meta.category === "count") return [baseUnit];
  return Object.keys(UNIT_META).filter(u => UNIT_META[u]?.category === meta.category);
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const UNITS = ["tsp", "tbsp", "fl oz", "cup", "oz", "lb", "g", "kg", "piece", "slice", "can", "bottle", "scoop", "packet", "bar", "serving"];

const DEFAULT_SETTINGS = {
  age: 45, weight: 215, height: 70, sex: "male",
  activityLevel: "light", vestWeight: 25,
  deficitCalories: 1500, refeedCalories: 2600,
  proteinTarget: 160, refeedProteinTarget: 190,
  sodiumTarget: 1500, refeedSodiumTarget: 2300,
  fiberTarget: 38,
};

const PRELOADED_HISTORY = {
  "2026-04-25": {
    meta: { dayType: "deficit" },
    entries: [
      { item: "1 cup coffee w/ milk + stevia", calories: 29, sodium: 15, protein: 1, fiber: 0 },
      { item: "3 piece Egg (large)", calories: 210, sodium: 210, protein: 18, fiber: 0 },
      { item: "0.5 tsp Sriracha", calories: 3, sodium: 35, protein: 0, fiber: 0 },
      { item: "1 can Wild Planet Sardines", calories: 170, sodium: 260, protein: 18, fiber: 0 },
      { item: "1 tsp Furikake", calories: 10, sodium: 83, protein: 0, fiber: 0 },
      { item: "1 tsp Olive Oil", calories: 40, sodium: 0, protein: 0, fiber: 0 },
      { item: "1 tsp Lemon Juice", calories: 1, sodium: 0, protein: 0, fiber: 0 },
      { item: "1 tsp Apple Cider Vinegar", calories: 1, sodium: 0, protein: 0, fiber: 0 },
      { item: "2 can Wild Planet Sardines", calories: 340, sodium: 520, protein: 36, fiber: 0 },
      { item: "7.5 oz Baked Potato", calories: 160, sodium: 10, protein: 4, fiber: 2 },
      { item: "2 tsp Furikake", calories: 20, sodium: 166, protein: 0, fiber: 0 },
      { item: "2 tsp Olive Oil", calories: 80, sodium: 0, protein: 0, fiber: 0 },
      { item: "2 tsp Lemon Juice", calories: 2, sodium: 0, protein: 0, fiber: 0 },
      { item: "2 tsp Apple Cider Vinegar", calories: 2, sodium: 0, protein: 0, fiber: 0 },
      { item: "1 tbsp Sriracha", calories: 15, sodium: 100, protein: 0, fiber: 0 },
      { item: "2 slice Mama Cozzi's Five Cheese Pizza", calories: 43, sodium: 100, protein: 1, fiber: 0 },
    ],
  },
  "2026-04-26": {
    meta: { dayType: "refeed" },
    entries: [
      { item: "1 can Chicken of the Sea Sardines", calories: 190, sodium: 420, protein: 14, fiber: 0 },
      { item: "7.5 oz Baked Potato", calories: 160, sodium: 10, protein: 4, fiber: 2 },
      { item: "1 tsp Frank's Red Hot", calories: 2, sodium: 190, protein: 0, fiber: 0 },
      { item: "1 tsp Worcestershire Sauce", calories: 4, sodium: 55, protein: 0, fiber: 0 },
      { item: "1 tbsp Olive Oil", calories: 120, sodium: 0, protein: 0, fiber: 0 },
      { item: "1 tbsp Lemon Juice", calories: 4, sodium: 0, protein: 0, fiber: 0 },
      { item: "2 piece Egg (large) scrambled", calories: 140, sodium: 140, protein: 12, fiber: 0 },
      { item: "4 serving Hash Brown Patties", calories: 280, sodium: 200, protein: 8, fiber: 1 },
      { item: "1 cup coffee w/ 3 tbsp milk", calories: 29, sodium: 15, protein: 1, fiber: 0 },
      { item: "1 piece Milk Chocolate (Libeert)", calories: 130, sodium: 45, protein: 2, fiber: 0 },
      { item: "1 can Wild Planet Sardines (rinsed/soaked)", calories: 170, sodium: 145, protein: 18, fiber: 0 },
      { item: "1 bottle Protein Shake", calories: 150, sodium: 170, protein: 30, fiber: 0 },
      { item: "2 slice Swiss Cheese (Sargento)", calories: 140, sodium: 70, protein: 10, fiber: 0 },
      { item: "7.5 oz Baked Potato", calories: 160, sodium: 10, protein: 4, fiber: 2 },
      { item: "0.5 cup Avocado", calories: 120, sodium: 5, protein: 2, fiber: 5 },
      { item: "1 tbsp Olive Oil", calories: 120, sodium: 0, protein: 0, fiber: 0 },
    ],
  },
  "2026-04-27": {
    meta: { dayType: "deficit" },
    entries: [
      { item: "1 tbsp Whey Protein", calories: 43, sodium: 60, protein: 9, fiber: 0 },
      { item: "1 scoop Fish Collagen", calories: 35, sodium: 20, protein: 9, fiber: 0 },
      { item: "1 cup Coffee (black) w/ 2 tbsp milk", calories: 20, sodium: 10, protein: 1, fiber: 0 },
      { item: "3 piece Egg (large) boiled", calories: 210, sodium: 210, protein: 18, fiber: 0 },
      { item: "0.5 cup Avocado", calories: 120, sodium: 5, protein: 2, fiber: 5 },
      { item: "1.5 piece Chicken Drumstick (skin off)", calories: 165, sodium: 105, protein: 22, fiber: 0 },
      { item: "1 cup Whole Milk", calories: 150, sodium: 120, protein: 8, fiber: 0 },
      { item: "1 tbsp Peanut Butter", calories: 95, sodium: 75, protein: 4, fiber: 1 },
      { item: "1 scoop Fish Collagen", calories: 35, sodium: 20, protein: 9, fiber: 0 },
      { item: "3 tbsp Regular Yogurt", calories: 35, sodium: 15, protein: 1, fiber: 0 },
      { item: "2 can Wild Planet Sardines (rinsed/soaked)", calories: 340, sodium: 285, protein: 36, fiber: 0 },
      { item: "3 piece Egg (large) scrambled", calories: 210, sodium: 210, protein: 18, fiber: 0 },
      { item: "1 cup Broccoli (steamed)", calories: 55, sodium: 30, protein: 4, fiber: 5 },
      { item: "2 scoop Fish Collagen", calories: 70, sodium: 40, protein: 18, fiber: 0 },
      { item: "1 tsp Lemon Juice", calories: 1, sodium: 0, protein: 0, fiber: 0 },
      { item: "1 tsp Olive Oil", calories: 40, sodium: 0, protein: 0, fiber: 0 },
      { item: "1 tsp Apple Cider Vinegar", calories: 1, sodium: 0, protein: 0, fiber: 0 },
      { item: "1 tsp Sriracha", calories: 5, sodium: 70, protein: 0, fiber: 0 },
    ],
  },
  "2026-04-28": {
    meta: { dayType: "refeed" },
    entries: [
      { item: "1 piece Ice Cream Sandwich", calories: 130, sodium: 115, protein: 4, fiber: 4 },
      { item: "1 can Wild Planet Sardines (rinsed/soaked)", calories: 170, sodium: 145, protein: 18, fiber: 0 },
      { item: "0.5 cup Black Beans (canned, rinsed)", calories: 110, sodium: 120, protein: 7, fiber: 5 },
      { item: "1 cup Coffee (black) w/ 0.25 cup milk", calories: 38, sodium: 30, protein: 2, fiber: 0 },
      { item: "3 tsp Sriracha", calories: 15, sodium: 210, protein: 0, fiber: 0 },
      { item: "1 tsp Olive Oil", calories: 40, sodium: 0, protein: 0, fiber: 0 },
      { item: "1 scoop Fish Collagen", calories: 35, sodium: 20, protein: 9, fiber: 0 },
      { item: "0.75 cup Greek Yogurt (0% fat)", calories: 100, sodium: 55, protein: 17, fiber: 0 },
      { item: "0.5 cup Protein Oatmeal (Seven Sundays)", calories: 230, sodium: 135, protein: 10, fiber: 7 },
      { item: "1 tbsp Maple Syrup", calories: 52, sodium: 1, protein: 0, fiber: 0 },
      { item: "0.75 cup Black Beans (canned, rinsed)", calories: 165, sodium: 180, protein: 11, fiber: 8 },
      { item: "0.5 cup Cottage Cheese (fat free)", calories: 100, sodium: 280, protein: 13, fiber: 0 },
      { item: "2 slice Light Bread", calories: 90, sodium: 160, protein: 4, fiber: 3 },
      { item: "6 oz Chicken Breast (pan cooked)", calories: 278, sodium: 113, protein: 53, fiber: 0 },
      { item: "1 tbsp Sriracha", calories: 15, sodium: 210, protein: 0, fiber: 0 },
      { item: "1 piece Ice Cream Sandwich", calories: 130, sodium: 115, protein: 4, fiber: 4 },
      { item: "0.75 cup Greek Yogurt (0% fat)", calories: 100, sodium: 55, protein: 17, fiber: 0 },
      { item: "1 cup Whole Milk", calories: 150, sodium: 120, protein: 8, fiber: 0 },
      { item: "1 tbsp Maple Syrup", calories: 52, sodium: 1, protein: 0, fiber: 0 },
      { item: "1 scoop Fish Collagen", calories: 35, sodium: 20, protein: 9, fiber: 0 },
      { item: "2 tbsp Peanut Powder", calories: 50, sodium: 0, protein: 6, fiber: 1 },
      { item: "2 slice Swiss Cheese (Sargento)", calories: 140, sodium: 70, protein: 10, fiber: 0 },
      { item: "7.5 oz Baked Potato", calories: 160, sodium: 10, protein: 4, fiber: 2 },
      { item: "0.5 cup Avocado", calories: 120, sodium: 5, protein: 2, fiber: 5 },
      { item: "1 tbsp Olive Oil", calories: 120, sodium: 0, protein: 0, fiber: 0 },
    ],
  },
};

const DEFAULT_LIBRARY = [
  { name: "Wild Planet Sardines", unit: "can", calories: 170, sodium: 145, protein: 18, fiber: 0 },
  { name: "Wild Planet Sardines (rinsed/soaked)", unit: "can", calories: 170, sodium: 145, protein: 18, fiber: 0 },
  { name: "Chicken of the Sea Sardines", unit: "can", calories: 190, sodium: 420, protein: 14, fiber: 0 },
  { name: "Whey Protein", unit: "scoop", calories: 150, sodium: 320, protein: 30, fiber: 1 },
  { name: "Fish Collagen", unit: "scoop", calories: 35, sodium: 20, protein: 9, fiber: 0 },
  { name: "Protein Shake", unit: "bottle", calories: 150, sodium: 170, protein: 30, fiber: 0 },
  { name: "Egg (large)", unit: "piece", calories: 70, sodium: 70, protein: 6, fiber: 0 },
  { name: "Egg White", unit: "piece", calories: 17, sodium: 55, protein: 4, fiber: 0 },
  { name: "Baked Potato", unit: "oz", calories: 21, sodium: 1, protein: 0.5, fiber: 0.3 },
  { name: "Avocado", unit: "cup", calories: 240, sodium: 10, protein: 3, fiber: 10 },
  { name: "Whole Milk", unit: "cup", calories: 150, sodium: 120, protein: 8, fiber: 0 },
  { name: "Fat Free Milk", unit: "cup", calories: 80, sodium: 130, protein: 8, fiber: 0 },
  { name: "Coffee (black)", unit: "cup", calories: 2, sodium: 5, protein: 0, fiber: 0 },
  { name: "Sriracha", unit: "tbsp", calories: 15, sodium: 210, protein: 0, fiber: 0 },
  { name: "Olive Oil", unit: "tbsp", calories: 120, sodium: 0, protein: 0, fiber: 0 },
  { name: "Lemon Juice", unit: "tbsp", calories: 4, sodium: 0, protein: 0, fiber: 0 },
  { name: "Apple Cider Vinegar", unit: "tbsp", calories: 3, sodium: 0, protein: 0, fiber: 0 },
  { name: "Furikake", unit: "tsp", calories: 10, sodium: 83, protein: 0, fiber: 0 },
  { name: "Peanut Butter", unit: "tbsp", calories: 95, sodium: 75, protein: 4, fiber: 1 },
  { name: "Peanut Powder", unit: "tbsp", calories: 25, sodium: 0, protein: 3, fiber: 0.5 },
  { name: "Maple Syrup", unit: "tbsp", calories: 52, sodium: 1, protein: 0, fiber: 0 },
  { name: "Stevia Packet", unit: "packet", calories: 0, sodium: 0, protein: 0, fiber: 0 },
  { name: "Ice Cream Sandwich", unit: "piece", calories: 130, sodium: 115, protein: 4, fiber: 4 },
  { name: "Milk Chocolate (Libeert)", unit: "piece", calories: 130, sodium: 45, protein: 2, fiber: 0 },
  { name: "Black Beans (canned, rinsed)", unit: "cup", calories: 220, sodium: 240, protein: 14, fiber: 10 },
  { name: "Greek Yogurt (0% fat)", unit: "cup", calories: 133, sodium: 73, protein: 23, fiber: 0 },
  { name: "Cottage Cheese (fat free)", unit: "cup", calories: 200, sodium: 560, protein: 26, fiber: 0 },
  { name: "Cottage Cheese (2% Breakstone)", unit: "cup", calories: 200, sodium: 560, protein: 26, fiber: 0 },
  { name: "Protein Oatmeal (Seven Sundays)", unit: "cup", calories: 460, sodium: 270, protein: 20, fiber: 14 },
  { name: "Light Bread", unit: "slice", calories: 45, sodium: 80, protein: 2, fiber: 1.5 },
  { name: "Flour Tortilla", unit: "piece", calories: 130, sodium: 300, protein: 3, fiber: 0 },
  { name: "Chicken Drumstick (skin off)", unit: "piece", calories: 110, sodium: 70, protein: 15, fiber: 0 },
  { name: "Chicken Breast (pan cooked)", unit: "oz", calories: 46, sodium: 19, protein: 9, fiber: 0 },
  { name: "Chicken Leg Quarter (skin off)", unit: "piece", calories: 290, sodium: 180, protein: 40, fiber: 0 },
  { name: "Ground Beef Patty", unit: "oz", calories: 56, sodium: 25, protein: 6, fiber: 0 },
  { name: "Chicken Wings (grilled)", unit: "piece", calories: 70, sodium: 60, protein: 8, fiber: 0 },
  { name: "Cucumber", unit: "cup", calories: 16, sodium: 2, protein: 1, fiber: 0.5 },
  { name: "Roma Tomato", unit: "piece", calories: 11, sodium: 3, protein: 0.5, fiber: 0.5 },
  { name: "Broccoli (steamed)", unit: "cup", calories: 55, sodium: 30, protein: 4, fiber: 5 },
  { name: "Worcestershire Sauce", unit: "tsp", calories: 4, sodium: 55, protein: 0, fiber: 0 },
  { name: "Low Sodium Ketchup", unit: "tbsp", calories: 10, sodium: 35, protein: 0, fiber: 0 },
  { name: "Chia Seeds", unit: "tbsp", calories: 60, sodium: 5, protein: 3, fiber: 5 },
  { name: "Ground Flaxseed", unit: "tbsp", calories: 37, sodium: 5, protein: 1, fiber: 3 },
  { name: "Creatine Monohydrate", unit: "scoop", calories: 0, sodium: 0, protein: 0, fiber: 0 },
  { name: "Swiss Cheese (Sargento)", unit: "slice", calories: 70, sodium: 35, protein: 5, fiber: 0 },
  { name: "Medjool Date", unit: "piece", calories: 66, sodium: 0, protein: 0, fiber: 2 },
  { name: "Frank's Red Hot", unit: "tsp", calories: 2, sodium: 190, protein: 0, fiber: 0 },
  { name: "Chickpeas (boiled, salted)", unit: "cup", calories: 270, sodium: 150, protein: 15, fiber: 13 },
  { name: "Peanut Oil", unit: "tbsp", calories: 120, sodium: 0, protein: 0, fiber: 0 },
  { name: "Paprika", unit: "tsp", calories: 6, sodium: 1, protein: 0, fiber: 0 },
  { name: "Dash Table Blend", unit: "tsp", calories: 0, sodium: 0, protein: 0, fiber: 0 },
  { name: "Regular Yogurt", unit: "tbsp", calories: 12, sodium: 5, protein: 0.3, fiber: 0 },
  { name: "Mama Cozzi's Five Cheese Pizza", unit: "slice", calories: 320, sodium: 750, protein: 14, fiber: 0 },
];

const LIBRARY_KEY = "nt-library-v2";
const LOG_KEY = "nt-log-v1";
const META_KEY = "nt-meta-v1";
const SETTINGS_KEY = "nt-settings-v1";
const OLD_LIBRARY_KEY = "nt-library-v1";
const HISTORY_SEEDED_KEY = "nt-history-seeded-v1";

const C = {
  bg: "#0a0a0f", card: "#13131f", border: "#ffffff15", gold: "#e2b96f",
  text: "#e8e6e0", muted: "#a0998c", green: "#22c55e", yellow: "#f59e0b",
  red: "#ef4444", input: "#1a1a2e",
};

function suggestUnit(name) {
  const n = name.toLowerCase();
  if (/milk|juice|broth|coffee|shake|drink/.test(n)) return "cup";
  if (/oil|sauce|syrup|vinegar|ketchup|mustard|sriracha|hot sauce/.test(n)) return "tbsp";
  if (/powder|protein|collagen|creatine/.test(n)) return "scoop";
  if (/sardine|tuna|salmon|bean|chickpea/.test(n) && /can/.test(n)) return "can";
  if (/egg/.test(n)) return "piece";
  if (/bread|toast|cheese|pizza/.test(n)) return "slice";
  if (/chocolate|bar|cookie|date|fruit/.test(n)) return "piece";
  if (/chicken|beef|pork|fish|meat|steak/.test(n)) return "oz";
  if (/oat|rice|grain|cereal|bean|lentil|chickpea|quinoa|pasta|yogurt|cottage/.test(n)) return "cup";
  if (/butter|spread|jam|honey|peanut/.test(n)) return "tbsp";
  if (/spice|seasoning|salt|pepper|cumin|paprika|garlic|furikake/.test(n)) return "tsp";
  if (/spinach|kale|lettuce|salad|broccoli|vegetable/.test(n)) return "cup";
  return "serving";
}

function migrateOldLibraryItem(item) {
  if (item.unit) return item;
  const name = item.name || "";
  const fractionMap = { "1/4": 0.25, "1/3": 0.333, "1/2": 0.5, "2/3": 0.667, "3/4": 0.75 };
  function parseFraction(str) {
    if (fractionMap[str]) return fractionMap[str];
    if (str.includes("/")) { const [a, b] = str.split("/"); return parseFloat(a) / parseFloat(b); }
    return parseFloat(str) || 1;
  }
  const patterns = [
    /^(\d+\/\d+|\d+\.?\d*)\s+(tsp|tbsp|cup|oz|lb|g|fl oz)\s+(.+)/i,
    /^(\d+)\s+(can|bottle|scoop|piece|slice|packet|bar)s?\s+(.+)/i,
  ];
  for (const re of patterns) {
    const m = name.match(re);
    if (m) {
      const qty = parseFraction(m[1]);
      const unit = m[2].toLowerCase();
      return { name: m[3].trim(), unit: UNITS.includes(unit) ? unit : "serving", calories: Math.round((item.calories || 0) / qty), sodium: Math.round((item.sodium || 0) / qty), protein: Math.round(((item.protein || 0) / qty) * 10) / 10, fiber: Math.round(((item.fiber || 0) / qty) * 10) / 10 };
    }
  }
  return { name, unit: suggestUnit(name), calories: item.calories || 0, sodium: item.sodium || 0, protein: item.protein || 0, fiber: item.fiber || 0 };
}

function calculateBMR(s) {
  const wkg = s.weight * 0.453592, hcm = s.height * 2.54;
  return s.sex === "male" ? 10 * wkg + 6.25 * hcm - 5 * s.age + 5 : 10 * wkg + 6.25 * hcm - 5 * s.age - 161;
}
function calculateTDEE(s) {
  return calculateBMR(s) * ({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }[s.activityLevel] || 1.375);
}
function parseNutritionFromText(text) {
  const result = { name: "", calories: 0, sodium: 0, protein: 0, fiber: 0 };
  const t = text.replace(/\n/g, " ");
  function findAfter(pattern) { const m = t.match(new RegExp(pattern + "[^0-9]{0,15}(\\d+\\.?\\d*)", "i")); return m ? parseFloat(m[1]) : 0; }
  result.calories = findAfter("calories") || findAfter("cal\\b");
  result.sodium = findAfter("sodium") || findAfter("\\bna\\b");
  result.protein = findAfter("protein");
  result.fiber = findAfter("dietary fiber") || findAfter("total fiber") || findAfter("\\bfiber\\b");
  return result;
}
function getWeekStart(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return new Date(d.setDate(d.getDate() - d.getDay())).toISOString().split("T")[0];
}
function formatWeekRange(ws) {
  const start = new Date(ws + "T12:00:00"), end = new Date(start);
  end.setDate(start.getDate() + 6);
  const o = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", o)} – ${end.toLocaleDateString("en-US", o)}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}
function formatDateLabel(dateStr) {
  const today = new Date().toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === addDays(today, -1)) return "Yesterday";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── SPLASH SCREEN ───────────────────────────────────────────────────────────

function SplashScreen({ onDone }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const taglineSlide = useRef(new Animated.Value(20)).current;
  const exitAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Fade in title
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(slideAnim, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      ]),
      Animated.delay(400),
      // Fade in hadith + tagline
      Animated.parallel([
        Animated.timing(taglineAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(taglineSlide, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      ]),
      Animated.delay(2200),
      // Fade out entire screen
      Animated.timing(exitAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[ss.splash, { opacity: exitAnim }]}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: "center", marginBottom: 48 }}>
        <Text style={ss.splashTitle}>Qawi</Text>
        <Text style={ss.splashSub}>قوي</Text>
      </Animated.View>
      <Animated.View style={{ opacity: taglineAnim, transform: [{ translateY: taglineSlide }], alignItems: "center", paddingHorizontal: 32 }}>
        <Text style={ss.splashHadith}>
          "The strong believer is better and more beloved to Allah than the weak believer."
        </Text>
        <Text style={ss.splashSource}>— Sahih Muslim 2664</Text>
        <Text style={ss.splashTagline}>Realign your intention.</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [tab, setTab] = useState("log");
  const [dayType, setDayType] = useState("deficit");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [entries, setEntries] = useState([]);
  const [library, setLibrary] = useState(DEFAULT_LIBRARY);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [allLogs, setAllLogs] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState("1");
  const [logUnit, setLogUnit] = useState(null);
  const [showLogUnitPicker, setShowLogUnitPicker] = useState(false);
  const [flash, setFlash] = useState("");
  const [libSearch, setLibSearch] = useState("");
  const [newFood, setNewFood] = useState({ name: "", unit: "serving", calories: "", sodium: "", protein: "", fiber: "" });
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanModal, setScanModal] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [scannedUnit, setScannedUnit] = useState("serving");
  const [showScannedUnitPicker, setShowScannedUnitPicker] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const isFuture = date > today;
  const storageKey = `${LOG_KEY}-${date}`;
  const metaKey = `${META_KEY}-${date}`;

  useEffect(() => { loadData(); }, [date]);
  useEffect(() => { if (tab === "history") loadAllHistory(); }, [tab]);
  useEffect(() => { if (selected) setLogUnit(selected.unit); }, [selected]);

  async function seedHistory() {
    try {
      if (await AsyncStorage.getItem(HISTORY_SEEDED_KEY)) return;
      for (const [d, data] of Object.entries(PRELOADED_HISTORY)) {
        if (!await AsyncStorage.getItem(`${LOG_KEY}-${d}`)) {
          await AsyncStorage.setItem(`${LOG_KEY}-${d}`, JSON.stringify(data.entries));
          await AsyncStorage.setItem(`${META_KEY}-${d}`, JSON.stringify(data.meta));
        }
      }
      await AsyncStorage.setItem(HISTORY_SEEDED_KEY, "true");
    } catch {}
  }

  async function loadData() {
    setLoaded(false);
    await seedHistory();
    try { const e = await AsyncStorage.getItem(storageKey); setEntries(e ? JSON.parse(e) : []); } catch { setEntries([]); }
    try { const m = await AsyncStorage.getItem(metaKey); if (m) setDayType(JSON.parse(m).dayType || "deficit"); } catch {}
    try { const sv = await AsyncStorage.getItem(SETTINGS_KEY); if (sv) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(sv) }); } catch {}
    try {
      const l2 = await AsyncStorage.getItem(LIBRARY_KEY);
      if (l2) { setLibrary(JSON.parse(l2)); }
      else {
        const l1 = await AsyncStorage.getItem(OLD_LIBRARY_KEY);
        const migrated = l1 ? JSON.parse(l1).map(migrateOldLibraryItem) : DEFAULT_LIBRARY;
        setLibrary(migrated);
        await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(migrated));
      }
    } catch { setLibrary(DEFAULT_LIBRARY); }
    setLoaded(true);
  }

  async function loadAllHistory() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const pairs = await AsyncStorage.multiGet(keys.filter(k => k.startsWith(LOG_KEY + "-")));
      const logs = {};
      pairs.forEach(([k, v]) => { try { logs[k.replace(LOG_KEY + "-", "")] = JSON.parse(v); } catch {} });
      setAllLogs(logs);
    } catch {}
  }

  useEffect(() => { if (!loaded) return; AsyncStorage.setItem(storageKey, JSON.stringify(entries)).catch(() => {}); }, [entries, loaded]);
  useEffect(() => { if (!loaded) return; AsyncStorage.setItem(metaKey, JSON.stringify({ dayType })).catch(() => {}); }, [dayType, loaded]);
  useEffect(() => { if (!loaded) return; AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(library)).catch(() => {}); }, [library, loaded]);
  useEffect(() => { if (!loaded) return; AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {}); }, [settings, loaded]);

  const targets = dayType === "deficit"
    ? { calories: settings.deficitCalories, sodium: settings.sodiumTarget, protein: settings.proteinTarget, fiber: settings.fiberTarget }
    : { calories: settings.refeedCalories, sodium: settings.refeedSodiumTarget, protein: settings.refeedProteinTarget, fiber: settings.fiberTarget };

  const totals = entries.reduce((acc, e) => ({
    calories: acc.calories + (parseFloat(e.calories) || 0),
    sodium: acc.sodium + (parseFloat(e.sodium) || 0),
    protein: acc.protein + (parseFloat(e.protein) || 0),
    fiber: acc.fiber + (parseFloat(e.fiber) || 0),
  }), { calories: 0, sodium: 0, protein: 0, fiber: 0 });

  const remaining = { calories: targets.calories - totals.calories, sodium: targets.sodium - totals.sodium, protein: targets.protein - totals.protein, fiber: targets.fiber - totals.fiber };
  const dvPct = Math.round((totals.sodium / 2300) * 100);
  const filtered = library.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
  const libFiltered = library.filter(f => f.name.toLowerCase().includes(libSearch.toLowerCase()));

  function showFlash(msg) { setFlash(msg); setTimeout(() => setFlash(""), 2500); }

  function getScaledNutrition() {
    if (!selected || !logUnit) return null;
    const q = parseFloat(qty) || 0;
    if (q === 0) return null;
    const factor = getConversionFactor(selected.unit, logUnit);
    if (factor === null) return null;
    const scale = q * factor;
    return {
      calories: Math.round(selected.calories * scale),
      sodium: Math.round(selected.sodium * scale),
      protein: Math.round(selected.protein * scale * 10) / 10,
      fiber: Math.round(selected.fiber * scale * 10) / 10,
    };
  }

  const scaled = getScaledNutrition();
  const unitMismatch = selected && logUnit && getConversionFactor(selected.unit, logUnit) === null && selected.unit !== logUnit;

  function addEntry() {
    if (!selected || !scaled) return;
    setEntries([...entries, { item: `${qty} ${logUnit} ${selected.name}`, calories: scaled.calories, sodium: scaled.sodium, protein: scaled.protein, fiber: scaled.fiber }]);
    setSelected(null); setSearch(""); setQty("1"); setLogUnit(null); setShowDropdown(false);
    showFlash("✓ Added: " + selected.name);
  }

  function deleteEntry(idx) {
    Alert.alert("Remove Entry", "Remove this item?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { setEntries(entries.filter((_, i) => i !== idx)); showFlash("Entry removed"); } }
    ]);
  }

  function addToLibrary() {
    if (!newFood.name.trim()) return;
    setLibrary([...library, { name: newFood.name.trim(), unit: newFood.unit, calories: parseFloat(newFood.calories) || 0, sodium: parseFloat(newFood.sodium) || 0, protein: parseFloat(newFood.protein) || 0, fiber: parseFloat(newFood.fiber) || 0 }]);
    setNewFood({ name: "", unit: "serving", calories: "", sodium: "", protein: "", fiber: "" });
    showFlash("✓ Added to library");
  }

  function deleteFromLibrary(idx) {
    Alert.alert("Remove Food", "Remove from library?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { setLibrary(library.filter((_, i) => i !== idx)); showFlash("Removed from library"); } }
    ]);
  }

  async function scanLabel() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission needed", "Camera permission is required."); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false });
      if (result.canceled) return;
      setScanning(true);
      const recognized = await TextRecognition.recognize(result.assets[0].uri);
      const parsed = parseNutritionFromText(recognized.text);
      parsed.rawText = recognized.text;
      setScannedData(parsed); setScannedUnit("serving"); setScanning(false); setScanModal(true);
    } catch { setScanning(false); Alert.alert("Scan failed", "Try better lighting or a closer angle."); }
  }

  function confirmScan() {
    if (!scannedData) return;
    setLibrary([...library, { name: scannedData.name || "Scanned Food", unit: scannedUnit, calories: parseFloat(scannedData.calories) || 0, sodium: parseFloat(scannedData.sodium) || 0, protein: parseFloat(scannedData.protein) || 0, fiber: parseFloat(scannedData.fiber) || 0 }]);
    setScanModal(false); setScannedData(null); showFlash("✓ Added to library");
  }

  async function exportData() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const all = await AsyncStorage.multiGet(keys);
      const obj = {}; all.forEach(([k, v]) => { obj[k] = v; });
      const uri = FileSystem.documentDirectory + `nutrition-backup-${date}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(obj, null, 2));
      await Share.share({ url: uri, message: "Nutrition tracker backup" });
      showFlash("✓ Backup created");
    } catch (err) { Alert.alert("Export failed", err.message); }
  }

  function calculateWeeklyData() {
    const tdee = calculateTDEE(settings);
    const weeks = {};
    Object.keys(allLogs).forEach(d => {
      const ws = getWeekStart(d);
      if (!weeks[ws]) weeks[ws] = { days: 0, cal: 0, sod: 0, pro: 0, fib: 0 };
      const dt = (allLogs[d] || []).reduce((a, e) => ({ cal: a.cal + (parseFloat(e.calories) || 0), sod: a.sod + (parseFloat(e.sodium) || 0), pro: a.pro + (parseFloat(e.protein) || 0), fib: a.fib + (parseFloat(e.fiber) || 0) }), { cal: 0, sod: 0, pro: 0, fib: 0 });
      if ((allLogs[d] || []).length > 0) { weeks[ws].days++; weeks[ws].cal += dt.cal; weeks[ws].sod += dt.sod; weeks[ws].pro += dt.pro; weeks[ws].fib += dt.fib; }
    });
    return Object.keys(weeks).sort().reverse().slice(0, 26).map(ws => {
      const w = weeks[ws];
      const avgCal = w.days ? w.cal / w.days : 0;
      return { ws, days: w.days, avgCal, avgSod: w.days ? w.sod / w.days : 0, avgPro: w.days ? w.pro / w.days : 0, avgFib: w.days ? w.fib / w.days : 0, lbsLost: ((tdee - avgCal) * w.days) / 3500 };
    });
  }

  function barColor(val, target) { const p = val / target; if (p >= 1) return C.red; if (p >= 0.8) return C.yellow; return C.green; }
  function pct(val, target) { return Math.min(100, (val / target) * 100); }
  const logUnitOptions = selected ? compatibleUnits(selected.unit) : UNITS;
  const qtyNum = parseFloat(qty) || 0;

  if (showSplash) return <SplashScreen onDone={() => setShowSplash(false)} />;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={20}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Qawi</Text>
          <Text style={s.headerSub}>DAILY NUTRITION LOG</Text>
        </View>
        {tab === "log" && (
          <View style={s.dayToggle}>
            {["deficit", "refeed"].map(t => (
              <TouchableOpacity key={t} onPress={() => setDayType(t)} style={[s.toggleBtn, dayType === t && s.toggleBtnActive]}>
                <Text style={[s.toggleText, dayType === t && s.toggleTextActive]}>{t.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Date Navigator */}
      {tab === "log" && (
        <View style={s.dateNav}>
          <TouchableOpacity onPress={() => setDate(addDays(date, -1))} style={s.dateArrow}>
            <Text style={s.dateArrowText}>◀</Text>
          </TouchableOpacity>
          <View style={s.dateLabelWrap}>
            <Text style={s.dateLabel}>{formatDateLabel(date)}</Text>
            <Text style={s.dateSub}>{date}</Text>
          </View>
          <TouchableOpacity onPress={() => { if (!isFuture) setDate(addDays(date, 1)); }} style={[s.dateArrow, isFuture && { opacity: 0.3 }]}>
            <Text style={s.dateArrowText}>▶</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Metrics */}
      {tab === "log" && (
        <View style={s.metricsRow}>
          {[
            { label: "CAL", val: totals.calories, target: targets.calories, unit: "", rem: remaining.calories },
            { label: "SODIUM", val: totals.sodium, target: targets.sodium, unit: "mg", rem: remaining.sodium, extra: `${dvPct}%DV` },
            { label: "PROTEIN", val: totals.protein, target: targets.protein, unit: "g", rem: remaining.protein },
            { label: "FIBER", val: totals.fiber, target: targets.fiber, unit: "g", rem: remaining.fiber },
          ].map(({ label, val, target, unit, rem, extra }) => (
            <View key={label} style={s.metricCard}>
              <Text style={s.metricLabel}>{label}</Text>
              <Text style={s.metricVal}>{Math.round(val)}<Text style={s.metricUnit}>{unit}</Text></Text>
              {extra && <Text style={[s.metricSub, { color: C.gold }]}>{extra}</Text>}
              <Text style={[s.metricSub, { color: rem < 0 ? C.red : C.green }]}>{rem < 0 ? `${Math.abs(Math.round(rem))}${unit} over` : `${Math.round(rem)}${unit} left`}</Text>
              <View style={s.barBg}><View style={[s.barFill, { width: `${pct(val, target)}%`, backgroundColor: barColor(val, target) }]} /></View>
            </View>
          ))}
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        {[{ key: "log", label: "📋 LOG" }, { key: "library", label: "📚 LIB" }, { key: "history", label: "📊 HIST" }, { key: "settings", label: "⚙️ SET" }].map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[s.tabBtn, tab === t.key && s.tabBtnActive]}>
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!!flash && <Text style={s.flash}>{flash}</Text>}

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

        {/* LOG TAB */}
        {tab === "log" && (
          <View style={s.pad}>
            <View style={s.card}>
              <Text style={s.cardTitle}>ADD FOOD</Text>
              <TextInput style={s.input} placeholder="Search food library..." placeholderTextColor={C.muted}
                value={search} onChangeText={t => { setSearch(t); setShowDropdown(true); setSelected(null); setLogUnit(null); }} onFocus={() => setShowDropdown(true)} />
              {showDropdown && search.length > 0 && filtered.length > 0 && (
                <View style={s.dropdown}>
                  <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filtered.map((f, i) => (
                      <TouchableOpacity key={i} onPress={() => { setSelected(f); setSearch(f.name); setShowDropdown(false); }} style={[s.dropItem, selected?.name === f.name && s.dropItemActive]}>
                        <Text style={[s.dropItemText, selected?.name === f.name && { color: C.gold }]} numberOfLines={1}>{f.name}</Text>
                        <Text style={s.dropItemMeta}>{f.calories}cal/{f.unit} · {f.protein}g pro</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              {selected && (
                <View style={s.preview}>
                  <Text style={s.previewName}>{selected.name}</Text>
                  <Text style={s.previewUnit}>stored per 1 {selected.unit}</Text>
                  <View style={s.previewRow}>
                    {[["Cal", selected.calories], ["Na", `${selected.sodium}mg`], ["Pro", `${selected.protein}g`], ["Fib", `${selected.fiber}g`]].map(([l, v]) => (
                      <View key={l} style={s.previewItem}><Text style={s.previewLabel}>{l}</Text><Text style={s.previewVal}>{v}</Text></View>
                    ))}
                  </View>
                </View>
              )}
              {selected && (
                <View style={s.row}>
                  <View style={{ width: 90 }}>
                    <Text style={s.fieldLabel}>QTY</Text>
                    <TextInput style={[s.input, { textAlign: "center" }]} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholderTextColor={C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>UNIT</Text>
                    <TouchableOpacity onPress={() => setShowLogUnitPicker(true)} style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                      <Text style={{ color: logUnit === selected.unit ? C.text : C.gold, fontSize: 14 }}>{logUnit || selected.unit}</Text>
                      <Text style={{ color: C.muted }}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {unitMismatch && (
                <View style={[s.preview, { backgroundColor: "#ef444415", borderColor: "#ef444430" }]}>
                  <Text style={{ color: C.red, fontSize: 11 }}>⚠ Can't convert {selected.unit} → {logUnit}. Select a compatible unit.</Text>
                </View>
              )}
              {selected && scaled && !unitMismatch && qtyNum > 0 && (
                <View style={[s.preview, { marginTop: 6 }]}>
                  <Text style={s.previewUnit}>{qty} {logUnit} · scaled nutrition</Text>
                  <View style={s.previewRow}>
                    {[["Cal", scaled.calories], ["Na", `${scaled.sodium}mg`], ["Pro", `${scaled.protein}g`], ["Fib", `${scaled.fiber}g`]].map(([l, v]) => (
                      <View key={l} style={s.previewItem}><Text style={s.previewLabel}>{l}</Text><Text style={[s.previewVal, { color: C.gold }]}>{v}</Text></View>
                    ))}
                  </View>
                </View>
              )}
              <TouchableOpacity onPress={addEntry} disabled={!selected || !scaled || unitMismatch} style={[s.addBtn, { marginTop: 8, opacity: (!selected || !scaled || unitMismatch) ? 0.4 : 1 }]}>
                <Text style={s.addBtnText}>ADD TO LOG</Text>
              </TouchableOpacity>
            </View>

            {entries.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>LOG — {formatDateLabel(date).toUpperCase()}</Text>
                {entries.map((e, i) => (
                  <View key={i} style={[s.entryRow, i > 0 && s.entryBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.entryName} numberOfLines={2}>{i + 1}. {e.item}</Text>
                      <Text style={s.entrySub}>{e.calories}cal · {e.sodium}mg · {e.protein}g pro · {e.fiber}g fib</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteEntry(i)} style={s.deleteBtn}><Text style={s.deleteBtnText}>✕</Text></TouchableOpacity>
                  </View>
                ))}
                <View style={[s.entryRow, s.entryBorder, { backgroundColor: "#ffffff08", borderRadius: 6, marginTop: 4, padding: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.entryName, { color: C.gold }]}>TOTAL</Text>
                    <Text style={[s.entrySub, { color: C.gold }]}>{Math.round(totals.calories)}cal · {Math.round(totals.sodium)}mg · {Math.round(totals.protein)}g pro · {Math.round(totals.fiber)}g fib</Text>
                  </View>
                </View>
                <View style={[s.entryRow, { padding: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.entryName, { color: C.green }]}>REMAINING</Text>
                    <Text style={s.entrySub}>
                      <Text style={{ color: remaining.calories < 0 ? C.red : C.green }}>{Math.round(remaining.calories)}cal</Text>{" · "}
                      <Text style={{ color: remaining.sodium < 0 ? C.red : C.green }}>{Math.round(remaining.sodium)}mg</Text>{" · "}
                      <Text style={{ color: remaining.protein < 0 ? C.red : C.green }}>{Math.round(remaining.protein)}g pro</Text>{" · "}
                      <Text style={{ color: remaining.fiber < 0 ? C.red : C.green }}>{Math.round(remaining.fiber)}g fib</Text>
                    </Text>
                  </View>
                </View>
              </View>
            )}
            {entries.length === 0 && loaded && (
              <View style={s.card}>
                <Text style={s.empty}>{date === today ? "No entries yet. Search above to add food." : `No entries for ${formatDateLabel(date)}. Add past meals above.`}</Text>
              </View>
            )}
            <View style={{ height: 20 }} />
          </View>
        )}

        {/* LIBRARY TAB */}
        {tab === "library" && (
          <View style={s.pad}>
            <TouchableOpacity onPress={scanLabel} disabled={scanning} style={s.scanBtn}>
              {scanning ? <ActivityIndicator color={C.bg} /> : <Text style={s.scanBtnText}>📷  SCAN NUTRITION LABEL</Text>}
            </TouchableOpacity>
            <View style={s.card}>
              <Text style={s.cardTitle}>ADD NEW FOOD</Text>
              <TextInput style={s.input} placeholder="Food name..." placeholderTextColor={C.muted} value={newFood.name} onChangeText={t => setNewFood({ ...newFood, name: t, unit: suggestUnit(t) })} />
              <Text style={s.fieldLabel}>UNIT (nutrition values are per 1 of this unit)</Text>
              <TouchableOpacity onPress={() => setShowUnitPicker(true)} style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                <Text style={{ color: C.text, fontSize: 14 }}>{newFood.unit}</Text>
                <Text style={{ color: C.muted }}>▼</Text>
              </TouchableOpacity>
              <View style={s.fieldsRow}>
                {["calories", "sodium", "protein", "fiber"].map(f => (
                  <View key={f} style={{ flex: 1, marginHorizontal: 3 }}>
                    <Text style={s.fieldLabel}>{f === "calories" ? "CAL" : f === "sodium" ? "NA" : f === "protein" ? "PRO" : "FIB"}</Text>
                    <TextInput style={[s.input, { textAlign: "center", paddingHorizontal: 4 }]} placeholder="0" placeholderTextColor={C.muted} keyboardType="decimal-pad" value={newFood[f]} onChangeText={t => setNewFood({ ...newFood, [f]: t })} />
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={addToLibrary} style={s.addBtn}><Text style={s.addBtnText}>ADD TO LIBRARY</Text></TouchableOpacity>
            </View>
            <TextInput style={s.input} placeholder="Search library..." placeholderTextColor={C.muted} value={libSearch} onChangeText={setLibSearch} />
            <View style={s.card}>
              {libFiltered.length === 0 && <Text style={s.empty}>No items found.</Text>}
              {libFiltered.map((f, i) => (
                <View key={i} style={[s.entryRow, i > 0 && s.entryBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.entryName} numberOfLines={1}>{f.name}</Text>
                    <Text style={s.entrySub}>per {f.unit} · {f.calories}cal · {f.sodium}mg · {f.protein}g pro · {f.fiber}g fib</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteFromLibrary(library.indexOf(f))} style={s.deleteBtn}><Text style={s.deleteBtnText}>✕</Text></TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <View style={s.pad}>
            <View style={s.card}>
              <Text style={s.cardTitle}>26-WEEK HISTORY</Text>
              <Text style={[s.entrySub, { marginBottom: 12, color: C.gold }]}>TDEE: {Math.round(calculateTDEE(settings))} cal · BMR: {Math.round(calculateBMR(settings))} cal/day</Text>
              {calculateWeeklyData().length === 0
                ? <Text style={s.empty}>No history yet. Log meals or navigate to past dates to add entries.</Text>
                : calculateWeeklyData().map((w, i) => (
                  <View key={w.ws} style={[s.weekCard, i > 0 && { marginTop: 8 }]}>
                    <View style={s.weekHeader}>
                      <Text style={s.weekRange}>{formatWeekRange(w.ws)}</Text>
                      <Text style={[s.weekLoss, { color: w.lbsLost > 0 ? C.green : C.red }]}>{w.lbsLost > 0 ? "−" : "+"}{Math.abs(w.lbsLost).toFixed(1)} lbs</Text>
                    </View>
                    <Text style={s.weekDays}>{w.days} day{w.days !== 1 ? "s" : ""} logged</Text>
                    <View style={s.weekStats}>
                      {[["AVG CAL", Math.round(w.avgCal)], ["AVG NA", Math.round(w.avgSod)], ["AVG PRO", `${Math.round(w.avgPro)}g`], ["AVG FIB", `${Math.round(w.avgFib)}g`]].map(([l, v]) => (
                        <View key={l} style={s.weekStat}><Text style={s.weekStatLabel}>{l}</Text><Text style={s.weekStatVal}>{v}</Text></View>
                      ))}
                    </View>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <View style={s.pad}>
            <View style={s.card}>
              <Text style={s.cardTitle}>PERSONAL STATS</Text>
              {[{ key: "age", label: "AGE (years)" }, { key: "weight", label: "WEIGHT (lbs)" }, { key: "height", label: "HEIGHT (inches)" }, { key: "vestWeight", label: "VEST WEIGHT (lbs)" }].map(f => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={s.fieldLabel}>{f.label}</Text>
                  <TextInput style={s.input} keyboardType="decimal-pad" placeholderTextColor={C.muted} value={String(settings[f.key])} onChangeText={t => setSettings({ ...settings, [f.key]: parseFloat(t) || 0 })} />
                </View>
              ))}
              <Text style={s.fieldLabel}>SEX</Text>
              <View style={[s.dayToggle, { alignSelf: "flex-start", marginBottom: 10 }]}>
                {["male", "female"].map(t => (
                  <TouchableOpacity key={t} onPress={() => setSettings({ ...settings, sex: t })} style={[s.toggleBtn, settings.sex === t && s.toggleBtnActive]}>
                    <Text style={[s.toggleText, settings.sex === t && s.toggleTextActive]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.fieldLabel}>ACTIVITY LEVEL</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
                {["sedentary", "light", "moderate", "active"].map(t => (
                  <TouchableOpacity key={t} onPress={() => setSettings({ ...settings, activityLevel: t })} style={[s.actBtn, settings.activityLevel === t && s.actBtnActive]}>
                    <Text style={[s.actBtnText, settings.activityLevel === t && { color: C.bg, fontWeight: "bold" }]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.entrySub, { color: C.gold }]}>BMR: {Math.round(calculateBMR(settings))} · TDEE: {Math.round(calculateTDEE(settings))} cal/day</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>DEFICIT DAY TARGETS</Text>
              {[{ key: "deficitCalories", label: "CALORIES" }, { key: "proteinTarget", label: "PROTEIN (g)" }, { key: "sodiumTarget", label: "SODIUM (mg)" }, { key: "fiberTarget", label: "FIBER (g)" }].map(f => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={s.fieldLabel}>{f.label}</Text>
                  <TextInput style={s.input} keyboardType="decimal-pad" placeholderTextColor={C.muted} value={String(settings[f.key])} onChangeText={t => setSettings({ ...settings, [f.key]: parseFloat(t) || 0 })} />
                </View>
              ))}
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>REFEED DAY TARGETS</Text>
              {[{ key: "refeedCalories", label: "CALORIES" }, { key: "refeedProteinTarget", label: "PROTEIN (g)" }, { key: "refeedSodiumTarget", label: "SODIUM (mg)" }].map(f => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={s.fieldLabel}>{f.label}</Text>
                  <TextInput style={s.input} keyboardType="decimal-pad" placeholderTextColor={C.muted} value={String(settings[f.key])} onChangeText={t => setSettings({ ...settings, [f.key]: parseFloat(t) || 0 })} />
                </View>
              ))}
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>DATA BACKUP</Text>
              <Text style={[s.entrySub, { marginBottom: 10 }]}>Export your data as a JSON file. Save to Google Drive or email for safekeeping.</Text>
              <TouchableOpacity onPress={exportData} style={s.addBtn}><Text style={s.addBtnText}>📤  EXPORT BACKUP</Text></TouchableOpacity>
            </View>
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Log Unit Picker Modal */}
      <Modal visible={showLogUnitPicker} transparent animationType="slide" onRequestClose={() => setShowLogUnitPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>SELECT LOG UNIT</Text>
            <Text style={s.modalSub}>Stored as: per 1 {selected?.unit} · Compatible units shown first</Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {logUnitOptions.map(u => (
                <TouchableOpacity key={u} onPress={() => { setLogUnit(u); setShowLogUnitPicker(false); }} style={[s.unitItem, logUnit === u && s.unitItemActive]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[s.unitItemText, logUnit === u && { color: C.gold, fontWeight: "bold" }]}>{u}</Text>
                    {u === selected?.unit && <Text style={{ color: C.muted, fontSize: 10 }}>BASE</Text>}
                  </View>
                </TouchableOpacity>
              ))}
              {logUnitOptions.length < UNITS.length && (
                <>
                  <View style={{ padding: 10, backgroundColor: "#ffffff08" }}>
                    <Text style={{ color: C.muted, fontSize: 10, letterSpacing: 2 }}>INCOMPATIBLE (no conversion)</Text>
                  </View>
                  {UNITS.filter(u => !logUnitOptions.includes(u)).map(u => (
                    <TouchableOpacity key={u} onPress={() => { setLogUnit(u); setShowLogUnitPicker(false); }} style={[s.unitItem, { opacity: 0.4 }]}>
                      <Text style={s.unitItemText}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowLogUnitPicker(false)} style={[s.addBtn, { marginTop: 12, backgroundColor: "#ffffff15" }]}>
              <Text style={[s.addBtnText, { color: C.text }]}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Library Unit Picker Modal */}
      <Modal visible={showUnitPicker} transparent animationType="slide" onRequestClose={() => setShowUnitPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>SELECT UNIT</Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {UNITS.map(u => (
                <TouchableOpacity key={u} onPress={() => { setNewFood({ ...newFood, unit: u }); setShowUnitPicker(false); }} style={[s.unitItem, newFood.unit === u && s.unitItemActive]}>
                  <Text style={[s.unitItemText, newFood.unit === u && { color: C.gold, fontWeight: "bold" }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowUnitPicker(false)} style={[s.addBtn, { marginTop: 12, backgroundColor: "#ffffff15" }]}>
              <Text style={[s.addBtnText, { color: C.text }]}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Scanned Unit Picker Modal */}
      <Modal visible={showScannedUnitPicker} transparent animationType="slide" onRequestClose={() => setShowScannedUnitPicker(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>SELECT UNIT</Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {UNITS.map(u => (
                <TouchableOpacity key={u} onPress={() => { setScannedUnit(u); setShowScannedUnitPicker(false); }} style={[s.unitItem, scannedUnit === u && s.unitItemActive]}>
                  <Text style={[s.unitItemText, scannedUnit === u && { color: C.gold, fontWeight: "bold" }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowScannedUnitPicker(false)} style={[s.addBtn, { marginTop: 12, backgroundColor: "#ffffff15" }]}>
              <Text style={[s.addBtnText, { color: C.text }]}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Scan Result Modal */}
      <Modal visible={scanModal} transparent animationType="slide" onRequestClose={() => { setScanModal(false); setScannedData(null); }}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>SCAN RESULTS</Text>
            <Text style={s.modalSub}>Review and edit before saving</Text>
            {scannedData?.rawText !== undefined && (
              <ScrollView style={{ maxHeight: 80, backgroundColor: "#000", padding: 8, borderRadius: 6, marginBottom: 10 }}>
                <Text style={{ color: "#6b9e6b", fontSize: 9 }}>RAW OCR:{"\n"}{scannedData.rawText || "(empty)"}</Text>
              </ScrollView>
            )}
            <Text style={s.fieldLabel}>FOOD NAME</Text>
            <TextInput style={s.input} placeholder="Enter food name..." placeholderTextColor={C.muted} value={scannedData?.name || ""} onChangeText={t => setScannedData({ ...scannedData, name: t })} />
            <Text style={s.fieldLabel}>UNIT (nutrition is per 1 of this unit)</Text>
            <TouchableOpacity onPress={() => setShowScannedUnitPicker(true)} style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }]}>
              <Text style={{ color: C.text, fontSize: 14 }}>{scannedUnit}</Text>
              <Text style={{ color: C.muted }}>▼</Text>
            </TouchableOpacity>
            <View style={s.fieldsRow}>
              {["calories", "sodium", "protein", "fiber"].map(f => (
                <View key={f} style={{ flex: 1, marginHorizontal: 3 }}>
                  <Text style={s.fieldLabel}>{f === "calories" ? "CAL" : f === "sodium" ? "NA" : f === "protein" ? "PRO" : "FIB"}</Text>
                  <TextInput style={[s.input, { textAlign: "center", paddingHorizontal: 4 }]} keyboardType="decimal-pad" placeholderTextColor={C.muted} value={String(scannedData?.[f] || "")} onChangeText={t => setScannedData({ ...scannedData, [f]: t })} />
                </View>
              ))}
            </View>
            <View style={s.row}>
              <TouchableOpacity onPress={() => { setScanModal(false); setScannedData(null); }} style={[s.addBtn, { backgroundColor: "#ffffff15", flex: 0.4 }]}>
                <Text style={[s.addBtnText, { color: C.text }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmScan} style={[s.addBtn, { flex: 0.6 }]}>
                <Text style={s.addBtnText}>SAVE TO LIBRARY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  splash: { flex: 1, backgroundColor: "#0a0a0f", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  splashTitle: { fontSize: 56, fontWeight: "900", color: "#e2b96f", letterSpacing: 4, textAlign: "center" },
  splashSub: { fontSize: 28, color: "#e2b96f80", marginTop: 4, textAlign: "center" },
  splashHadith: { fontSize: 15, color: "#e8e6e0", textAlign: "center", lineHeight: 24, fontStyle: "italic", marginBottom: 10 },
  splashSource: { fontSize: 11, color: "#a0998c", letterSpacing: 2, marginBottom: 24, textAlign: "center" },
  splashTagline: { fontSize: 18, color: "#e2b96f", letterSpacing: 3, fontWeight: "bold", textAlign: "center", textTransform: "uppercase" },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: "#16213e", paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 28, fontWeight: "900", color: C.gold, letterSpacing: 1 },
  headerSub: { fontSize: 9, color: C.muted, letterSpacing: 3, marginTop: 2 },
  dayToggle: { flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: C.border, marginTop: 6 },
  toggleBtn: { paddingVertical: 7, paddingHorizontal: 12, backgroundColor: "transparent" },
  toggleBtnActive: { backgroundColor: C.gold },
  toggleText: { fontSize: 10, color: C.text, letterSpacing: 1 },
  toggleTextActive: { color: C.bg, fontWeight: "bold" },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#16213e", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  dateArrow: { padding: 8 },
  dateArrowText: { color: C.gold, fontSize: 16 },
  dateLabelWrap: { alignItems: "center" },
  dateLabel: { color: C.text, fontSize: 15, fontWeight: "bold" },
  dateSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  metricsRow: { flexDirection: "row", padding: 8, gap: 6 },
  metricCard: { flex: 1, backgroundColor: C.card, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.border },
  metricLabel: { fontSize: 8, color: C.muted, letterSpacing: 1, marginBottom: 2 },
  metricVal: { fontSize: 16, fontWeight: "bold", color: C.text },
  metricUnit: { fontSize: 9, color: C.muted },
  metricSub: { fontSize: 8, marginTop: 1 },
  barBg: { height: 3, backgroundColor: "#ffffff15", borderRadius: 2, marginTop: 5, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  tabs: { flexDirection: "row", paddingHorizontal: 12, gap: 6, paddingBottom: 8, paddingTop: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: "#ffffff10", alignItems: "center" },
  tabBtnActive: { backgroundColor: C.gold },
  tabText: { fontSize: 10, color: C.text, letterSpacing: 1 },
  tabTextActive: { color: C.bg, fontWeight: "bold" },
  flash: { textAlign: "center", color: C.gold, fontSize: 11, letterSpacing: 2, paddingBottom: 6 },
  scroll: { flex: 1 },
  pad: { padding: 12 },
  card: { backgroundColor: C.card, borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontSize: 9, color: C.gold, letterSpacing: 3, marginBottom: 10 },
  input: { backgroundColor: C.input, borderWidth: 1, borderColor: C.border, borderRadius: 6, color: C.text, padding: 10, fontSize: 14, marginBottom: 8 },
  dropdown: { backgroundColor: "#0d0d1a", borderWidth: 1, borderColor: C.border, borderRadius: 6, marginBottom: 8 },
  dropItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dropItemActive: { backgroundColor: "#e2b96f10" },
  dropItemText: { color: C.text, fontSize: 13, flex: 1 },
  dropItemMeta: { color: C.muted, fontSize: 11, marginLeft: 8 },
  preview: { backgroundColor: "#e2b96f10", borderWidth: 1, borderColor: "#e2b96f30", borderRadius: 6, padding: 10, marginBottom: 8 },
  previewName: { color: C.gold, fontSize: 12, fontWeight: "bold" },
  previewUnit: { color: C.muted, fontSize: 10, letterSpacing: 1, marginBottom: 4 },
  previewRow: { flexDirection: "row", justifyContent: "space-between" },
  previewItem: { alignItems: "center" },
  previewLabel: { fontSize: 9, color: C.muted, letterSpacing: 1 },
  previewVal: { fontSize: 12, color: C.text, fontWeight: "bold" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  fieldsRow: { flexDirection: "row", marginBottom: 8 },
  fieldLabel: { fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 4 },
  addBtn: { flex: 1, backgroundColor: C.gold, borderRadius: 6, padding: 12, alignItems: "center" },
  addBtnText: { color: C.bg, fontWeight: "bold", fontSize: 13, letterSpacing: 1 },
  entryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  entryBorder: { borderTopWidth: 1, borderTopColor: C.border },
  entryName: { color: C.text, fontSize: 13, marginBottom: 2 },
  entrySub: { color: C.muted, fontSize: 11 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { color: C.red, fontSize: 16 },
  empty: { textAlign: "center", color: C.muted, fontSize: 13, padding: 20 },
  scanBtn: { backgroundColor: C.gold, borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 12 },
  scanBtnText: { color: C.bg, fontWeight: "bold", fontSize: 15, letterSpacing: 2 },
  modalOverlay: { flex: 1, backgroundColor: "#000000cc", justifyContent: "flex-end" },
  modalCard: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border },
  modalTitle: { fontSize: 12, color: C.gold, letterSpacing: 3, marginBottom: 4 },
  modalSub: { fontSize: 12, color: C.muted, marginBottom: 16 },
  unitItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  unitItemActive: { backgroundColor: "#e2b96f10" },
  unitItemText: { color: C.text, fontSize: 14 },
  weekCard: { backgroundColor: "#ffffff05", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: C.border },
  weekHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  weekRange: { color: C.gold, fontSize: 13, fontWeight: "bold" },
  weekLoss: { fontSize: 14, fontWeight: "bold" },
  weekDays: { color: C.muted, fontSize: 10, marginBottom: 8 },
  weekStats: { flexDirection: "row", justifyContent: "space-between" },
  weekStat: { alignItems: "center", flex: 1 },
  weekStatLabel: { fontSize: 8, color: C.muted, letterSpacing: 1 },
  weekStatVal: { fontSize: 13, color: C.text, fontWeight: "bold", marginTop: 2 },
  actBtn: { backgroundColor: "#ffffff10", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 },
  actBtnActive: { backgroundColor: C.gold },
  actBtnText: { fontSize: 10, color: C.text, letterSpacing: 1 },
});