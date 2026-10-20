import { createFileRoute } from "@tanstack/react-router";

import { LoginPage } from "@/features/auth/login-page.tsx";

// 업무 레이아웃(_app) 밖의 독립 화면. 인증 연결 전이라 성공 처리·이동이 없다.
export const Route = createFileRoute("/login")({ component: LoginPage });
