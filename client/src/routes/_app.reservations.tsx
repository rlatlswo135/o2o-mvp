import { createFileRoute, redirect } from "@tanstack/react-router";

import { ReservationsPage } from "@/features/reservations/reservations-page.tsx";
import { isSupportedDate } from "@/features/reservations/reservations.time.ts";

// cancelled는 켜졌을 때 숫자 1(주소 ?cancelled=1). 문자열 "1"로 쓰면 주소가 %221%22가 된다
type ReservationsSearch = {
  date?: string | undefined;
  cancelled?: string | number | undefined;
};

// 값은 거르지 않고 그대로 받아 beforeLoad가 잘못된 값을 주소에서 지운다
function validateSearch(search: Record<string, unknown>): ReservationsSearch {
  const { date, cancelled } = search;
  return {
    date: typeof date === "string" || typeof date === "number" ? String(date) : undefined,
    cancelled:
      typeof cancelled === "string" || typeof cancelled === "number" ? cancelled : undefined,
  };
}

export const Route = createFileRoute("/_app/reservations")({
  validateSearch,
  beforeLoad: ({ search }) => {
    const badDate = search.date !== undefined && !isSupportedDate(search.date);
    const badCancelled = search.cancelled !== undefined && String(search.cancelled) !== "1";
    // 잘못된 날짜는 오늘로, 잘못된 취소 포함 값은 꺼짐으로 조용히 바로잡는다
    if (badDate || badCancelled) {
      throw redirect({
        to: "/reservations",
        search: {
          date: badDate ? undefined : search.date,
          cancelled: badCancelled ? undefined : search.cancelled,
        },
        replace: true,
      });
    }
  },
  component: ReservationsPage,
});
