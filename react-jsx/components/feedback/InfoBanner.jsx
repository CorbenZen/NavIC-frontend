import { AlertTriangle, Info } from 'lucide-react';

export function InfoBanner({ children, tone = 'info' }) {
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <div className={tone === 'warning' ? 'warn-banner' : 'info-banner'}>
      <Icon />
      <div>{children}</div>
    </div>
  );
}
