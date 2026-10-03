import React from "react";

/**
 * Catches an error thrown while drawing a screen, tells the local crash log, and shows a plain message with a way back instead of a blank or
 * frozen screen. Saved data is untouched: sets are written to the phone when ticked, not when the screen closes.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; onError: (error: unknown) => void; fallback: (reset: () => void) => React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}
