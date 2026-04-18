interface TutorSetupWarningProps {
  onOpenSettings?: () => void;
}

export function TutorSetupWarning({ onOpenSettings }: TutorSetupWarningProps) {
  return (
    <div className="rounded-md border border-warn/30 bg-warn/10 p-3 text-xs leading-relaxed text-warn">
      <div className="mb-1 font-semibold">AI tutor setup required</div>
      <p className="text-warn/90">
        Add your OpenAI API key to unlock code explanations, hints, and lesson-aware guidance.
      </p>
      {onOpenSettings ? (
        <button
          onClick={onOpenSettings}
          className="mt-2 rounded-md bg-warn/20 px-2.5 py-1 text-[11px] font-semibold text-warn ring-1 ring-warn/30 transition hover:bg-warn/30"
        >
          Open Settings →
        </button>
      ) : (
        <p className="mt-1.5 text-warn/80">
          Open <span className="font-semibold">Settings</span> (gear icon in the header) to configure it.
        </p>
      )}
    </div>
  );
}
