import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '40px',
            backgroundColor: 'var(--surface)',
            color: 'var(--on-surface)',
            fontFamily: 'var(--font-sans)',
            gap: '20px',
            textAlign: 'center'
          }}
        >
          <span
            className="icon"
            style={{ fontSize: '64px', color: 'var(--error)' }}
          >
            error_outline
          </span>
          <h1 style={{ fontSize: '22px', fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--on-surface-variant)',
              maxWidth: '480px',
              lineHeight: 1.6
            }}
          >
            VelocityDL encountered an unexpected error. Your downloads are safe
            — please reload the application.
          </p>
          <code
            style={{
              fontSize: '11px',
              padding: '12px 20px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-container-lowest)',
              border: '1px solid var(--outline-variant)',
              maxWidth: '600px',
              overflow: 'auto',
              color: 'var(--error)',
              fontFamily: 'var(--font-mono)'
            }}
          >
            {this.state.error?.message || 'Unknown error'}
          </code>
          <button
            className="btn btn-primary"
            onClick={this.handleReload}
            style={{ marginTop: '8px', padding: '10px 28px' }}
          >
            <span className="icon" style={{ fontSize: '18px' }}>
              refresh
            </span>
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
