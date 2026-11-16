import { Inbox } from 'lucide-react';

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing to show', description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon />
      </div>
      <b>{title}</b>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
