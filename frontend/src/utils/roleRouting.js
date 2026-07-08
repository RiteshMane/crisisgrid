// Central place that decides which dashboard a role lands on after login.
// Keeping this in one file avoids scattering role->route logic everywhere.
export function dashboardPathForRole(role) {
  switch (role) {
    case 'eoc':
    case 'admin':
      return '/eoc';
    case 'rescue_team':
      return '/rescue';
    case 'hospital':
      return '/hospital';
    case 'shelter':
      return '/shelter';
    default:
      return '/citizen';
  }
}
