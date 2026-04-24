import { useEffect, useState } from "react";
import { CinematicGreeting } from "./CinematicGreeting";
import { useWelcomeBack } from "./useWelcomeBack";

// Always-mounted inside AuthedLayout. Renders null unless the trigger
// rule in useWelcomeBack says "fire." The overlay's render logic is
// intentionally trivial — all state + decision lives in the hook.
//
// Fires once per session via a local `hasRendered` latch: even if the
// shouldShow signal flickers (e.g., progress rehydrate mid-display), we
// keep rendering the same instance so the greeting doesn't reset
// partway through.
export function WelcomeBackOverlay() {
  const { shouldShow, firstName, copy, dismiss } = useWelcomeBack();
  // `wasShown` is the "once latched, stay visible" memory so hydration
  // flicker can't drop the overlay mid-reveal during its first few
  // beats. `active` is derived synchronously from `shouldShow ||
  // wasShown` so the overlay mounts in the same paint as the
  // dashboard (no one-frame flash). The effect below only flips
  // `wasShown` TRUE; the drop happens via handleComplete below or
  // via the allowed-route watcher, never implicitly.
  const [wasShown, setWasShown] = useState(false);
  const active = shouldShow || wasShown;

  useEffect(() => {
    if (shouldShow && !wasShown) setWasShown(true);
  }, [shouldShow, wasShown]);

  // Drop the latch if the user navigates off an allowed route mid-
  // overlay (click-through to a deep lesson link, etc.). Without
  // this, the overlay would follow them onto routes where
  // `shouldShow` is false, sitting on top of lesson content. We use
  // `shouldShow` as the proxy for "we're still on an allowed route"
  // because the hook already folds the ALLOWED_PATHS check into it.
  useEffect(() => {
    if (!shouldShow && wasShown) {
      setWasShown(false);
    }
  }, [shouldShow, wasShown]);

  if (!active || !copy) return null;

  const handleComplete = () => {
    dismiss();
    setWasShown(false);
  };

  return (
    <CinematicGreeting
      mode="minimal"
      firstName={firstName}
      heroLine={copy.hero}
      subtitle={copy.subtitle}
      onComplete={handleComplete}
      onSkip={handleComplete}
    />
  );
}
