import { Compass } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/States';
import { useDocumentTitle } from '../lib/hooks';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="container" style={{ paddingBlock: 'var(--space-12)' }}>
      <EmptyState
        title="This page took a wrong turn"
        icon={<Compass size={28} aria-hidden="true" />}
        actions={<ButtonLink to="/">Back to search</ButtonLink>}
      >
        The page you’re looking for doesn’t exist. It may have moved, or the link may be mistyped.
      </EmptyState>
    </div>
  );
}
