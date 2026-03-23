"use client";

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    // Sentry will auto-capture this via its React integration
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold mb-2">エラーが発生しました</h2>
          <p className="text-sm text-gray-500 mb-4">
            申し訳ありません。ページを再読み込みしてもう一度お試しください。
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            ページを再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
