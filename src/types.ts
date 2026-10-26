export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  categorySlug: string;
  artisan: string;
  location: string;
  image: string;
  imageAlt: string;
  label: string | null;
  description: string;
};

export type CartLine = {
  product: Product;
  quantity: number;
};

export type OrderReceipt = {
  reference: string;
  subtotal: number;
  shipping: number;
  total: number;
};

export type AccountUser = {
  id: string;
  name: string;
  email: string;
  role: 'buyer' | 'artisan';
  storeName: string | null;
  location: string | null;
};

export type DashboardOrder = {
  reference: string;
  subtotal?: number;
  total?: number;
  status: string;
  createdAt: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  productName?: string;
  quantity?: number;
  price?: number;
  customerName?: string;
  city?: string;
};

export type AccountDashboard = {
  role: 'buyer' | 'artisan';
  orders?: DashboardOrder[];
  favorites?: Product[];
  recommendations?: Product[];
  products?: Product[];
};
