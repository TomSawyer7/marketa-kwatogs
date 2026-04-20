export type Condition = "New" | "Used - Like New" | "Used - Good" | "Used - Fair";

export type Listing = {
  id: string;
  title: string;
  price: number;
  description: string;
  category: string;
  condition: Condition;
  location: string;
  images: string[]; // urls or data urls
  sellerId: string;
  createdAt: number;
};

export type Seller = {
  id: string;
  name: string;
  avatar: string;
  joinedAt: number;
  location: string;
  bio?: string;
  rating?: number;
};
