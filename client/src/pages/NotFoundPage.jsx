import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '../components/common/Button';

export function NotFoundPage() {
  return (
    <div className="py-20 flex flex-col items-center justify-center text-center px-4">
      <span className="text-6xl font-black text-brand-600">404</span>
      <h1 className="text-xl font-bold text-slate-800 mt-4">Page Not Found</h1>
      <p className="text-sm text-slate-500 mt-2 max-w-sm">
        The requested CRM view or route does not exist or hasn't been implemented yet in Phase 1.
      </p>
      <div className="mt-6">
        <Link to="/">
          <Button variant="primary" icon={Home}>
            Back to Overview
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
