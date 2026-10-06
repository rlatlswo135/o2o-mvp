import * as stylex from "@stylexjs/stylex";
import { useCallback, useRef, useState } from "react";

import type { NoticeContent } from "@/shared/ui/notice/notice.tsx";

import { Button } from "@/shared/ui/button/button.tsx";
import { LiveNotice } from "@/shared/ui/notice/notice.tsx";

import type { CustomerFormProps } from "./customer-form.tsx";

import { colors } from "../../shared/ui/theme.stylex.ts";
import { CustomerForm } from "./customer-form.tsx";
import { CustomerList } from "./customer-list.tsx";
import { CustomerMockControls } from "./customer-mock-controls.tsx";
import { CustomersShell } from "./customers-shell.tsx";
import { useCustomerMock } from "./use-customer-mock.ts";

const panelId = "customer-register-panel";
const panelTitleId = "customer-register-title";

const saveFailedNotice: NoticeContent = {
  tone: "danger",
  title: "고객을 저장하지 못했어요.",
  description: "입력 내용은 그대로 있어요. 잠시 후 다시 저장해주세요.",
};

/** 고객 관리 화면(FE 검토용 가상 동작). 목록 조회·고객 등록 흐름과 결과 알림을 조립한다. */
export function CustomersPage() {
  const {
    query,
    saving,
    save,
    reload: handleReload,
    listOutcome,
    setListOutcome: handleListOutcomeChange,
    saveOutcome,
    setSaveOutcome: handleSaveOutcomeChange,
  } = useCustomerMock();
  const [panelOpen, setPanelOpen] = useState(false);
  const [notice, setNotice] = useState<{ content: NoticeContent; id: number } | null>(null);
  const noticeSeq = useRef(0);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const showNotice = useCallback((content: NoticeContent) => {
    noticeSeq.current += 1;
    setNotice({ content, id: noticeSeq.current });
  }, []);

  // 이미 열려 있으면 새로 열지 않고 이름 입력으로 이동한다.
  const handleOpen = useCallback(() => {
    if (panelOpen) nameInputRef.current?.focus();
    else setPanelOpen(true);
  }, [panelOpen]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    openButtonRef.current?.focus();
  }, []);

  const handleSave = useCallback<CustomerFormProps["onSave"]>(
    (input, onDuplicate) => {
      const started = save(input, (result) => {
        if (result.kind === "duplicate") onDuplicate();
        if (result.kind === "failed") showNotice(saveFailedNotice);
        if (result.kind === "saved") {
          closePanel();
          showNotice({
            tone: "success",
            title: "고객을 등록했어요.",
            description: `${result.customer.name} 고객을 목록 맨 위에 추가했어요.`,
          });
        }
      });
      // 이전 결과 알림이 새 저장 결과로 오해되지 않게 비운다.
      if (started) setNotice(null);
    },
    [closePanel, save, showNotice],
  );

  // 닫기 버튼이 사라지므로 등록 버튼으로 포커스를 돌려준다.
  const handleNoticeClose = useCallback(() => {
    setNotice(null);
    openButtonRef.current?.focus();
  }, []);

  return (
    <CustomersShell>
      <div {...stylex.props(styles.body, panelOpen && styles.bodyWithPanel)}>
        <div {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.heading)}>
            <p {...stylex.props(styles.eyebrow)}>CUSTOMER MANAGEMENT</p>
            <div {...stylex.props(styles.titleRow)}>
              <h1 {...stylex.props(styles.title)}>고객</h1>
              {query.kind === "loaded" && (
                <span {...stylex.props(styles.count)}>{query.customers.length}명</span>
              )}
            </div>
          </div>
          <Button
            ref={openButtonRef}
            aria-expanded={panelOpen}
            aria-controls={panelOpen ? panelId : undefined}
            onClick={handleOpen}
          >
            + 고객 등록
          </Button>
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

        <div {...stylex.props(styles.notice)}>
          <LiveNotice
            notice={notice?.content ?? null}
            noticeKey={notice?.id}
            onClose={handleNoticeClose}
            closeLabel="알림 닫기"
          />
        </div>

        <div {...stylex.props(styles.list)}>
          <CustomerList query={query} onRetry={handleReload} />
          <p {...stylex.props(styles.note)}>
            지금은 가상 데이터예요. 새로고침하면 처음 예시로 돌아가니 실제 고객 정보는 입력하지
            마세요.
          </p>
        </div>

        <div {...stylex.props(styles.demo)}>
          <CustomerMockControls
            listOutcome={listOutcome}
            onListOutcomeChange={handleListOutcomeChange}
            saveOutcome={saveOutcome}
            onSaveOutcomeChange={handleSaveOutcomeChange}
            loading={query.kind === "loading"}
            onReload={handleReload}
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
    gridTemplateAreas: "'header' 'panel' 'notice' 'list' 'demo'",
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
      default: "'header' 'panel' 'notice' 'list' 'demo'",
      [wide]: "'header panel' 'notice panel' 'list panel' 'demo panel'",
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
  count: {
    paddingBlock: "2px",
    paddingInline: "10px",
    borderRadius: "999px",
    backgroundColor: colors.selectedSurface,
    color: colors.primary,
    fontSize: "13px",
    fontWeight: 600,
  },
  panel: {
    gridArea: "panel",
    minWidth: 0,
  },
  notice: {
    gridArea: "notice",
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
  note: {
    margin: 0,
    color: colors.textMuted,
    fontSize: "12px",
  },
  demo: {
    gridArea: "demo",
    minWidth: 0,
  },
});
