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
  // flicker can't drop the overlay mid-reveal. Intentionally only
  // flips TRUE — never back. `active` is derived synchronously from
  // `shouldShow || wasShown`; an earlier version computed it from a
  // useEffect that ran after commit, which let the dashboard paint
  // for one frame before the overlay mounted on the next render.
  const [wasShown, setWasShown] = useState(false);
  const active = shouldShow || wasShown;

  useEffect(() => {
    if (shouldShow && !wasShown) setWasShown(true);
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
