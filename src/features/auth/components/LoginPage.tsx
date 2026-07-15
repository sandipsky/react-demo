import { useNavigate } from "@tanstack/react-router";
import { useLogin } from "../auth.query"
import { useState } from "react";
import { useAuthStore } from "../auth.store";

export const LoginPage = () => {
    const login = useLogin();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const setAuth = useAuthStore((s) => s.setAuth); 

    const handleLogin = () => {
        login.mutate(
            { email, password },
            {
                onSuccess: (data) => {
                    setAuth(data.token, data.user);
                    navigate({ to: '/products' });
                },
            },
        )
    }

    return (
        <>
            <h1>Login</h1>

            <div>
                <label>Username</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="text" />
            </div>

            <div>
                <label>Password</label>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
            </div>

            <button onClick={handleLogin} disabled={login.isPending} >Login</button>

            {login.isError && login.error.message}
        </>
    )
}
