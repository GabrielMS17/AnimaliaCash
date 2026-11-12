export const VETERINARIAN_ROLE = 'Veterinário';

export const VETERINARIAN_ALLOWED_ROUTES = [
  '/banho-tosa',
  '/cirurgia',
  '/configuracoes',
  '/insumos',
  '/internacao',
];

export function isKnownRole(role) {
  return role === 'Administrador' || role === VETERINARIAN_ROLE;
}

export function canAccessRoute(role, route) {
  if (role === 'Administrador') return true;
  return role === VETERINARIAN_ROLE && VETERINARIAN_ALLOWED_ROUTES.includes(route);
}
