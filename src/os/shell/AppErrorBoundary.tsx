import { Component, type ReactNode } from 'react';
export class AppErrorBoundary extends Component<{ children: ReactNode; onRetry?: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() {
    return this.state.failed ? <div className="static-document" role="alert"><h1>This app didn't load.</h1><button onClick={() => { this.setState({ failed: false }); this.props.onRetry?.(); }}>Try again</button></div> : this.props.children;
  }
}
