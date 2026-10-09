import ky from "ky";

const serverUrl: string | undefined = import.meta.env.VITE_SERVER_URL;
if (!serverUrl) throw new Error("client/.env.local에 VITE_SERVER_URL을 설정해주세요.");

export const api = ky.create({ baseUrl: serverUrl, retry: 0 });
