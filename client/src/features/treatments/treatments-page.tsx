import * as stylex from "@stylexjs/stylex";
import { useIsMutating } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { Sheet } from "@/shared/ui/sheet/sheet.tsx";

import { colors, radii, shadows } from "../../shared/ui/theme.stylex.ts";
import { CreateTreatmentForm } from "./forms/create-treatment-form.tsx";
import { TreatmentList } from "./treatment-list.tsx";
import { treatmentMutationKeys } from "./treatments.api.ts";

const panelId = "treatment-panel";

export function TreatmentsPage() {
  // 저장 중에 시트를 닫으면 결과를 알릴 폼이 사라진다
  const saving = useIsMutating({ mutationKey: treatmentMutationKeys.all() }) > 0;
  const [open, setOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (!saving) setOpen(true);
  };

  const handleClose = () => setOpen(false);

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.header)}>
        <p {...stylex.props(styles.eyebrow)}>TREATMENTS</p>
        <h1 {...stylex.props(styles.title)}>시술</h1>
        <p {...stylex.props(styles.description)}>
          예약에 쓸 시술의 기본 소요시간과 가격을 관리해요.
        </p>
      </div>

      <div {...stylex.props(styles.card)}>
        <TreatmentList
          actions={
            <Button
              ref={openButtonRef}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              onClick={handleOpen}
            >
              + 시술 등록
            </Button>
          }
        />
      </div>

      <Sheet
        id={panelId}
        open={open}
        dismissible={!saving}
        returnFocus={() => openButtonRef.current}
        onClose={handleClose}
      >
        {open && <CreateTreatmentForm onClose={handleClose} />}
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
