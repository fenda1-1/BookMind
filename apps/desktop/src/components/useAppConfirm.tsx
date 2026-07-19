import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../i18n';

type PendingConfirm = {
  message: string;
  resolve: (confirmed: boolean) => void;
};

type AppConfirmHandler = (message: string) => Promise<boolean>;

let activeConfirmHandler: AppConfirmHandler | null = null;

export function registerAppConfirmHandler(handler: AppConfirmHandler) {
  activeConfirmHandler = handler;
  return () => {
    if (activeConfirmHandler === handler) activeConfirmHandler = null;
  };
}

export function requestAppConfirm(message: string) {
  return activeConfirmHandler ? activeConfirmHandler(message) : Promise.resolve(false);
}

export function useAppConfirm() {
  const { t } = useI18n();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((message: string) => new Promise<boolean>((resolve) => {
    setPendingConfirm({ message, resolve });
  }), []);

  useEffect(() => registerAppConfirmHandler(confirm), [confirm]);

  const close = useCallback((confirmed: boolean) => {
    setPendingConfirm((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const confirmDialog = pendingConfirm ? (
    <div className="modal-backdrop app-confirm-backdrop" role="presentation" onMouseDown={() => close(false)}>
      <section className="app-confirm-dialog" role="dialog" aria-modal="true" aria-label={t('common.confirm')} onMouseDown={(event) => event.stopPropagation()}>
        <p>{pendingConfirm.message}</p>
        <div className="action-row">
          <button className="app-confirm-cancel" type="button" onClick={() => close(false)}>{t('common.cancel')}</button>
          <button className="app-confirm-accept" type="button" onClick={() => close(true)}>{t('common.confirm')}</button>
        </div>
      </section>
    </div>
  ) : null;

  return { confirm, confirmDialog };
}
