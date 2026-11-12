export const VETERINARIAN_ROLE = 'Veterinário';

export const VETERINARIAN_ALLOWED_ROUTES = [
  '/banho-tosa',
  '/cirurgia',
  '/configuracoes',
  '/insumos',
  '/internacao',
];

export const ADMINISTRATOR_ALLOWED_ROUTES = [
  '/cadastros',
  '/configuracoes',
  '/custos',
  '/estoque',
  '/templates',
];

export function isKnownRole(role) {
  return role === 'Administrador' || role === VETERINARIAN_ROLE;
}

export function canAccessRoute(role, route) {
  if (role === 'Administrador') return ADMINISTRATOR_ALLOWED_ROUTES.includes(route);
  return role === VETERINARIAN_ROLE && VETERINARIAN_ALLOWED_ROUTES.includes(route);
}

/** Primeira tela de cada perfil (o app usa o mesmo destino). */
export function landingRoute(role) {
  return role === VETERINARIAN_ROLE ? '/banho-tosa' : '/cadastros';
}
