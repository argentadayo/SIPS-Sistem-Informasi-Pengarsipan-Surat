import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.label ?? "app", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-danger/20 bg-danger-soft px-6 py-10 text-center">
          <p className="text-base font-bold text-danger">
            {this.props.label ? `Error: ${this.props.label}` : "Terjadi kesalahan tampilan"}
          </p>
          <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-300">
            {this.state.error.message || "Unknown error"}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="secondary" onClick={() => this.setState({ error: null })}>
              Coba Lagi
            </Button>
            <Button type="button" onClick={() => window.location.assign("/")}>
              Ke Dashboard
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
