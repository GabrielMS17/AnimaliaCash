export const VETERINARIAN_ROLE = 'Veterinário';
export const ANIMAL_GROOMER_ROLE = 'Esteticista Animal';

export const VETERINARIAN_ALLOWED_ROUTES = [
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

export const ANIMAL_GROOMER_ALLOWED_ROUTES = ['/banho-tosa', '/insumos'];

export function isKnownRole(role) {
  return role === 'Administrador' || role === VETERINARIAN_ROLE || role === ANIMAL_GROOMER_ROLE;
}

export function canAccessRoute(role, route) {
  if (role === 'Administrador') return ADMINISTRATOR_ALLOWED_ROUTES.includes(route);
  if (role === ANIMAL_GROOMER_ROLE) return ANIMAL_GROOMER_ALLOWED_ROUTES.includes(route);
  return role === VETERINARIAN_ROLE && VETERINARIAN_ALLOWED_ROUTES.includes(route);
}
