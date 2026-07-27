export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export const DEMO_ADMIN = {
  name: 'Demo Administrator',
  username: 'demo-admin',
  email: 'admin@demo.local',
  role: 'System Administrator',
};

export const DEMO_EMPLOYEE = {
  name: 'Demo Dentist',
  email: 'dentist@demo.local',
  plan: 'free',
};
