import type { Customer } from "@o2o/shared/contracts";

import * as stylex from "@stylexjs/stylex";
import { useIsMutating } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { Sheet } from "@/shared/ui/sheet/sheet.tsx";

import { colors, radii, shadows } from "../../shared/ui/theme.stylex.ts";
import { CustomerList } from "./customer-list.tsx";
import { customerMutationKeys } from "./customers.api.ts";
import { CreateCustomerForm } from "./forms/create-customer-form.tsx";
import { EditCustomerForm } from "./forms/edit-customer-form.tsx";

const panelId = "customer-panel";

type PanelState = { mode: "create" } | { mode: "edit"; customer: Customer };

export function CustomersPage() {
  // 저장 중에 패널을 바꾸거나 닫으면 결과를 알릴 폼이 사라진다
  const saving = useIsMutating({ mutationKey: customerMutationKeys.all() }) > 0;
  const [panel, setPanel] = useState<PanelState | null>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleOpen = () => {
    if (saving) return;
    editTriggerRef.current = null;
    setPanel({ mode: "create" });
  };

  const handleEdit = (customer: Customer, trigger: HTMLButtonElement) => {
    if (saving) return;
    editTriggerRef.current = trigger;
    setPanel({ mode: "edit", customer });
  };

  const handleClose = () => setPanel(null);

  // 누른 버튼으로 포커스 복귀, 그 행이 사라졌으면 등록 버튼으로
  const findReturnFocus = () => {
    const trigger = editTriggerRef.current;
    return trigger?.isConnected ? trigger : openButtonRef.current;
  };

  const editingId = panel?.mode === "edit" ? panel.customer.id : undefined;

  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.header)}>
        <p {...stylex.props(styles.eyebrow)}>CUSTOMERS</p>
        <h1 {...stylex.props(styles.title)}>고객</h1>
        <p {...stylex.props(styles.description)}>단골 고객의 연락처를 한곳에서 관리해요.</p>
      </div>

      <div {...stylex.props(styles.card)}>
        <CustomerList
          onEdit={handleEdit}
          editingId={editingId}
          toolbar={
            <Button
              ref={openButtonRef}
              aria-haspopup="dialog"
              aria-expanded={panel?.mode === "create"}
              aria-controls={panel?.mode === "create" ? panelId : undefined}
              onClick={handleOpen}
            >
              + 고객 등록
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
        {panel?.mode === "create" && <CreateCustomerForm onClose={handleClose} />}
        {panel?.mode === "edit" && (
          <EditCustomerForm
            // 고객이 바뀌면 입력을 새로 시작
            key={panel.customer.id}
            customer={panel.customer}
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
