import type { Customer } from "@o2o/shared/contracts";

import * as stylex from "@stylexjs/stylex";
import { useIsMutating } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/shared/ui/button/button.tsx";

import { colors } from "../../shared/ui/theme.stylex.ts";
import { CustomerCount, CustomerList } from "./customer-list.tsx";
import { CustomersShell } from "./customers-shell.tsx";
import { customerMutationKeys } from "./customers.api.ts";
import { CreateCustomerForm } from "./forms/create-customer-form.tsx";
import { EditCustomerForm } from "./forms/edit-customer-form.tsx";

const panelId = "customer-panel";

type PanelState = { mode: "create" } | { mode: "edit"; customer: Customer };

export function CustomersPage() {
  // 저장 중에 패널을 바꾸면 결과를 알릴 폼이 사라진다
  const saving = useIsMutating({ mutationKey: customerMutationKeys.all() }) > 0;
  const [panel, setPanel] = useState<PanelState | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);

  // 이미 열린 패널을 다시 열면 첫 입력으로
  const focusPanel = () => panelRef.current?.querySelector("input")?.focus();

  const handleOpen = () => {
    if (saving) return;
    editTriggerRef.current = null;
    if (panel?.mode === "create") focusPanel();
    else setPanel({ mode: "create" });
  };

  const handleEdit = (customer: Customer, trigger: HTMLButtonElement) => {
    if (saving) return;
    editTriggerRef.current = trigger;
    if (panel?.mode === "edit" && panel.customer.id === customer.id) focusPanel();
    else setPanel({ mode: "edit", customer });
  };

  // 누른 버튼으로 포커스 복귀, 그 행이 사라졌으면 등록 버튼으로
  const closePanel = () => {
    const trigger = editTriggerRef.current;
    editTriggerRef.current = null;
    setPanel(null);
    (trigger?.isConnected ? trigger : openButtonRef.current)?.focus();
  };

  const editingId = panel?.mode === "edit" ? panel.customer.id : undefined;

  return (
    <CustomersShell>
      <div {...stylex.props(styles.body, panel !== null && styles.bodyWithPanel)}>
        <div {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.heading)}>
            <p {...stylex.props(styles.eyebrow)}>CUSTOMER MANAGEMENT</p>
            <div {...stylex.props(styles.titleRow)}>
              <h1 {...stylex.props(styles.title)}>고객</h1>
              <CustomerCount />
            </div>
          </div>
        </div>

        {panel !== null && (
          <div ref={panelRef} id={panelId} {...stylex.props(styles.panel)}>
            {panel.mode === "create" ? (
              <CreateCustomerForm onClose={closePanel} />
            ) : (
              <EditCustomerForm
                // 고객이 바뀌면 입력을 새로 시작
                key={panel.customer.id}
                customer={panel.customer}
                onClose={closePanel}
              />
            )}
          </div>
        )}

        <div {...stylex.props(styles.list)}>
          <CustomerList
            onEdit={handleEdit}
            editingId={editingId}
            toolbar={
              <Button
                ref={openButtonRef}
                aria-expanded={panel?.mode === "create"}
                aria-controls={panel?.mode === "create" ? panelId : undefined}
                onClick={handleOpen}
              >
                + 고객 등록
              </Button>
            }
          />
        </div>
      </div>
    </CustomersShell>
  );
}

const wide = "@media (min-width: 960px)";

const styles = stylex.create({
  body: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateAreas: "'header' 'panel' 'list'",
    alignItems: "start",
    gap: "16px",
    maxWidth: "1200px",
  },
  bodyWithPanel: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [wide]: "minmax(0, 1fr) 360px",
    },
    gridTemplateAreas: {
      default: "'header' 'panel' 'list'",
      [wide]: "'header panel' 'list panel'",
    },
  },
  header: {
    gridArea: "header",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "12px",
  },
  heading: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  eyebrow: {
    margin: 0,
    color: colors.primary,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  title: {
    margin: 0,
    fontSize: "26px",
  },
  panel: {
    gridArea: "panel",
    minWidth: 0,
  },
  list: {
    gridArea: "list",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
    padding: "20px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: "10px",
    backgroundColor: colors.surface,
  },
});
