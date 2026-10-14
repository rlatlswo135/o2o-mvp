import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Button } from "@/shared/ui/button/button.tsx";
import { toast } from "@/shared/ui/toast/toast.tsx";

import type { CustomerFormProps } from "./customer-form.tsx";
import type { CustomerInput } from "./customers.schema.ts";

import { colors } from "../../shared/ui/theme.stylex.ts";
import { CustomerForm } from "./customer-form.tsx";
import { CustomerCount, CustomerList } from "./customer-list.tsx";
import { CustomersShell } from "./customers-shell.tsx";
import { registerCustomer } from "./customers.api.ts";

const panelId = "customer-register-panel";
const panelTitleId = "customer-register-title";

/** 고객 목록 조회·등록과 결과 알림을 조립한다. */
export function CustomersPage() {
  const queryClient = useQueryClient();
  const { mutate, isPending: saving } = useMutation({
    mutationFn: (input: CustomerInput) => registerCustomer(queryClient, input),
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // 이미 열려 있으면 새로 열지 않고 이름 입력으로 이동한다.
  const handleOpen = () => {
    if (panelOpen) nameInputRef.current?.focus();
    else setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    openButtonRef.current?.focus();
  };

  const handleSave: CustomerFormProps["onSave"] = (input, showErrors) => {
    if (saving) return;
    mutate(input, {
      onSuccess: (result) => {
        switch (result.kind) {
          case "created":
            closePanel();
            toast.success({
              title: "고객을 등록했어요.",
              description: `${result.customer.name} 고객을 목록 맨 위에 추가했어요.`,
            });
            break;
          case "duplicate":
            showErrors({ phone: "이미 등록된 전화번호예요. 번호를 확인해주세요." });
            break;
          case "failed":
            // 패널과 입력 값은 그대로 두므로 알림이 사라져도 다시 저장할 수 있다.
            toast.error({
              title: "고객을 저장하지 못했어요.",
              description: "입력 내용은 그대로 있어요. 잠시 후 다시 저장해주세요.",
            });
            break;
        }
      },
    });
  };

  return (
    <CustomersShell>
      <div {...stylex.props(styles.body, panelOpen && styles.bodyWithPanel)}>
        <div {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.heading)}>
            <p {...stylex.props(styles.eyebrow)}>CUSTOMER MANAGEMENT</p>
            <div {...stylex.props(styles.titleRow)}>
              <h1 {...stylex.props(styles.title)}>고객</h1>
              <CustomerCount />
            </div>
          </div>
        </div>

        {panelOpen && (
          <div id={panelId} {...stylex.props(styles.panel)}>
            <CustomerForm
              titleId={panelTitleId}
              nameInputRef={nameInputRef}
              saving={saving}
              onSave={handleSave}
              onClose={closePanel}
            />
          </div>
        )}

        <div {...stylex.props(styles.list)}>
          <CustomerList
            toolbar={
              <Button
                ref={openButtonRef}
                aria-expanded={panelOpen}
                aria-controls={panelOpen ? panelId : undefined}
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
