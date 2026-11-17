import { defineConfig } from 'wxt';
export default defineConfig({
  manifest: {
    name: 'ticExt · Railway planner',
    description: 'Plan Bangladesh Railway journeys and schedule a booking start.',
    permissions: ['storage', 'alarms'],
    action: { default_title: 'Open ticExt' },
  },
});
