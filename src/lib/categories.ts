import {
  LayoutGrid, Car, Home, Sofa, Shirt, Smartphone, Gamepad2,
  Bike, Baby, Dog, Wrench, BookOpen, Music, Dumbbell,
} from "lucide-react";

export const CATEGORIES = [
  { slug: "all", name: "All categories", icon: LayoutGrid },
  { slug: "vehicles", name: "Vehicles", icon: Car },
  { slug: "property", name: "Property Rentals", icon: Home },
  { slug: "home", name: "Home Goods", icon: Sofa },
  { slug: "clothing", name: "Clothing", icon: Shirt },
  { slug: "electronics", name: "Electronics", icon: Smartphone },
  { slug: "games", name: "Toys & Games", icon: Gamepad2 },
  { slug: "sports", name: "Sports & Outdoors", icon: Bike },
  { slug: "baby", name: "Baby & Kids", icon: Baby },
  { slug: "pets", name: "Pet Supplies", icon: Dog },
  { slug: "tools", name: "Tools", icon: Wrench },
  { slug: "books", name: "Books & Media", icon: BookOpen },
  { slug: "music", name: "Musical Instruments", icon: Music },
  { slug: "fitness", name: "Fitness", icon: Dumbbell },
] as const;

export type CategorySlug = typeof CATEGORIES[number]["slug"];
