'use client';

import { SIDEBAR_VIEWS, type ActivityView, type SidebarViewContext } from './sidebar-views';

interface LeftPanelProps extends SidebarViewContext {
  view: ActivityView;
}

export default function LeftPanel({ view, ...ctx }: LeftPanelProps) {
  const v = SIDEBAR_VIEWS.find((entry) => entry.id === view);
  if (!v) return null;
  return <>{v.render(ctx)}</>;
}

export { SIDEBAR_VIEWS };
export type { ActivityView };
