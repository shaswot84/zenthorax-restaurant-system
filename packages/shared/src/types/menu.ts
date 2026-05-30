export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  nutritionInfo: NutritionInfo | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NutritionInfo {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface MenuWithCategories {
  categories: (MenuCategory & { items: MenuItem[] })[];
}
