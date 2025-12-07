import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'black', backgroundColor: 'white', height: '100vh' }}>
                    <h1>Something went wrong.</h1>
                    <div style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', textAlign: 'left', background: '#f0f0f0', padding: '1rem', border: '1px solid #ccc', color: 'black' }}>
                        <h3>Error:</h3>
                        {this.state.error && this.state.error.toString()}
                        <h3>Stack:</h3>
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </div>
                    <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
