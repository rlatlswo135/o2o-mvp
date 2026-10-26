import type { Reservation } from "@o2o/shared/contracts";

import * as stylex from "@stylexjs/stylex";
import { useIsMutating } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { Sheet } from "@/shared/ui/sheet/sheet.tsx";

import { colors, radii, shadows } from "../../shared/ui/theme.stylex.ts";
import { CancelReservationForm } from "./forms/cancel-reservation-form.tsx";
import { CreateReservationForm } from "./forms/create-reservation-form.tsx";
import { EditReservationForm } from "./forms/edit-reservation-form.tsx";
import { ReservationDateBar } from "./reservation-date-bar.tsx";
import { ReservationList } from "./reservation-list.tsx";
import { reservationMutationKeys } from "./reservations.api.ts";
import { isSupportedDate, todayKst } from "./reservations.time.ts";

const panelId = "reservation-panel";

const route = getRouteApi("/_app/reservations");

type PanelState =
  | { mode: "create" }
  | { mode: "edit"; reservation: Reservation }
  | { mode: "cancel"; reservation: Reservation };

type FinishOptions = {
  // 저장한 예약의 날짜. 지금 조회 날짜와 다르면 그 날짜로 옮긴다
  date?: string;
  // 누른 행 버튼이 사라지므로 등록 버튼으로 포커스를 돌린다
  focusOpen?: boolean;
};

export function ReservationsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const today = todayKst();
  const date = search.date !== undefined && isSupportedDate(search.date) ? search.date : today;
  const includeCancelled = search.cancelled !== undefined && String(search.cancelled) === "1";

  // 저장 중에 시트를 바꾸거나 닫으면 결과를 알릴 폼이 사라진다
  const saving = useIsMutating({ mutationKey: reservationMutationKeys.all() }) > 0;
  const [panel, setPanel] = useState<PanelState | null>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const rowTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleDateChange = (next: string) =>
    void navigate({ search: (prev) => ({ ...prev, date: next }) });

  const handleIncludeCancelledChange = (include: boolean) =>
    void navigate({
      search: (prev) => ({ ...prev, cancelled: include ? 1 : undefined }),
      replace: true,
    });

  const handleOpen = () => {
    if (saving) return;
    rowTriggerRef.current = null;
    setPanel({ mode: "create" });
  };

  const handleRowAction =
    (mode: "edit" | "cancel") => (reservation: Reservation, trigger: HTMLButtonElement) => {
      if (saving) return;
      rowTriggerRef.current = trigger;
      setPanel({ mode, reservation });
    };

  const handleClose = () => setPanel(null);

  const handleFinish = ({ date: savedDate, focusOpen }: FinishOptions = {}) => {
    const moved = savedDate !== undefined && savedDate !== date;
    if (focusOpen || moved) rowTriggerRef.current = null;
    if (moved) handleDateChange(savedDate);
    setPanel(null);
  };

  // 누른 행 버튼으로 포커스 복귀, 그 행이 사라졌으면 등록 버튼으로
  const findReturnFocus = () => {
    const trigger = rowTriggerRef.current;
    return trigger?.isConnected ? trigger : openButtonRef.current;
  };

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.header)}>
        <p {...stylex.props(styles.eyebrow)}>RESERVATIONS</p>
        <h1 {...stylex.props(styles.title)}>예약</h1>
        <p {...stylex.props(styles.description)}>날짜별로 예약을 확인하고 등록·수정·취소해요.</p>
      </div>

      <ReservationDateBar date={date} today={today} onChange={handleDateChange} />

      <div {...stylex.props(styles.card)}>
        <ReservationList
          date={date}
          includeCancelled={includeCancelled}
          editingId={panel?.mode === "edit" ? panel.reservation.id : undefined}
          cancellingId={panel?.mode === "cancel" ? panel.reservation.id : undefined}
          onIncludeCancelledChange={handleIncludeCancelledChange}
          onEdit={handleRowAction("edit")}
          onCancel={handleRowAction("cancel")}
          actions={
            <Button
              ref={openButtonRef}
              aria-haspopup="dialog"
              aria-expanded={panel?.mode === "create"}
              aria-controls={panel?.mode === "create" ? panelId : undefined}
              onClick={handleOpen}
            >
              + 예약 등록
            </Button>
          }
        />
      </div>

      <Sheet
        id={panelId}
        open={panel !== null}
        dismissible={!saving}
        returnFocus={findReturnFocus}
        onClose={handleClose}
      >
        {panel?.mode === "create" && (
          <CreateReservationForm viewDate={date} onFinish={handleFinish} onClose={handleClose} />
        )}
        {panel?.mode === "edit" && (
          <EditReservationForm
            // 예약이 바뀌면 입력을 새로 시작
            key={panel.reservation.id}
            reservation={panel.reservation}
            onFinish={handleFinish}
            onClose={handleClose}
          />
        )}
        {panel?.mode === "cancel" && (
          <CancelReservationForm
            key={panel.reservation.id}
            reservation={panel.reservation}
            onFinish={() => handleFinish({ focusOpen: true })}
            onClose={handleClose}
          />
        )}
      </Sheet>
    </div>
  );
}

const narrow = "@media (max-width: 719px)";

const styles = stylex.create({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: {
      default: "24px",
      [narrow]: "20px",
    },
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  eyebrow: {
    margin: 0,
    color: colors.accent,
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: "16px",
    letterSpacing: "0.14em",
  },
  title: {
    margin: 0,
    fontSize: {
      default: "30px",
      [narrow]: "24px",
    },
    fontWeight: 700,
    lineHeight: {
      default: "38px",
      [narrow]: "32px",
    },
    letterSpacing: "-0.02em",
  },
  description: {
    margin: 0,
    color: colors.textMuted,
    fontSize: "15px",
    lineHeight: "24px",
  },
  card: {
    minWidth: 0,
    padding: {
      default: "24px",
      [narrow]: "16px",
    },
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    boxShadow: shadows.card,
  },
});
