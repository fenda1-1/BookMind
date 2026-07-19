import { Component, type ErrorInfo, type ReactNode } from 'react';

type LazyLoadBoundaryProps = {
  children: ReactNode;
  resetKey: string;
  errorLabel: string;
  retryLabel: string;
  className?: string;
};

type LazyLoadBoundaryState = { failed: boolean };

export class LazyLoadBoundary extends Component<LazyLoadBoundaryProps, LazyLoadBoundaryState> {
  state: LazyLoadBoundaryState = { failed: false };

  static getDerivedStateFromError(): LazyLoadBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Failed to load a deferred BookMind view:', error, info.componentStack);
  }

  componentDidUpdate(previousProps: LazyLoadBoundaryProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className={this.props.className ?? 'app-page-load-error'} role="alert">
        <strong>{this.props.errorLabel}</strong>
        <button type="button" onClick={() => window.location.reload()}>{this.props.retryLabel}</button>
      </div>
    );
  }
}
