import { apiClient } from "@/lib";
import type { IProduct } from "./product.types";

export const getProducts = async () => {
  const res = await apiClient.get<IProduct[]>('/products');
  return res.data;
};

export const getProduct = async (id: number) => {
  const res = await apiClient.get<IProduct>(`/products/${id}`);
  return res.data;
};

export const createProduct = async (body: IProduct) => {
  const res = await apiClient.post<IProduct>('/products', body);
  return res.data;
};

export const updateProduct = async (id: number, body: IProduct) => {
  const res = await apiClient.put<IProduct>(`/products/${id}`, body);
  return res.data;
};

export const deleteProduct = async (id: number) => {
  await apiClient.delete(`/products/${id}`);
};
