export interface ILoginBody {
    email: string;
    password: string
}

export interface ILoginResponse {
    token: string;
    user: any;
}