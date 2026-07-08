
import { router } from "@/lib"
import { RouterProvider } from "@tanstack/react-router"

export const AppProviders = () => {
    return (
        <RouterProvider router={router} />
    )
}
