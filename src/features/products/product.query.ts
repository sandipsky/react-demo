
import {
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct
} from './products.api';
import type { IProduct } from './product.types';

export const productKeys = {
    all: ['products'] as const,
};

export const useProducts = () =>
    useQuery({
        queryKey: productKeys.all,
        queryFn: getProducts,
    });

export const useCreateProduct = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: IProduct) => createProduct(body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
    });
};

export const useUpdateProduct = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: number; body: IProduct }) =>
            updateProduct(id, body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
    });
};

export const useDeleteProduct = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteProduct(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: productKeys.all });
        },
    });
};
