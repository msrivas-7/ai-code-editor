import { Modal } from "./Modal";
import { SettingsPanel } from "./SettingsPanel";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      onClose={onClose}
      panelClassName="w-full max-w-2xl rounded-xl border border-border bg-panel p-5 shadow-xl"
    >
      <SettingsPanel onClose={onClose} />
    </Modal>
  );
}
