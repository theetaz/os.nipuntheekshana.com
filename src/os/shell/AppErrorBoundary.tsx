import { Component, type ReactNode } from 'react';
import { ErrorState } from '../ui/ErrorState';
export class AppErrorBoundary extends Component<{ children: ReactNode; onRetry?: () => void; onError?: () => void; simpleHref?: string }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onError?.(); }
  override render() {
    return this.state.failed ? <ErrorState role="alert" className="window-error" simpleHref={this.props.simpleHref}
      onRetry={() => { this.setState({ failed: false }); this.props.onRetry?.(); }} /> : this.props.children;
  }
}
