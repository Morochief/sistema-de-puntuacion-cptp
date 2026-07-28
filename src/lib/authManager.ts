import { supabase } from './supabase';

export type UserRole = 'admin' | 'staff' | 'spectator';

let currentRole: UserRole = 'spectator';

export async function checkAuth(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();
      
    if (roleData) {
      currentRole = roleData.role as UserRole;
    } else {
      currentRole = 'spectator';
    }
  } else {
    currentRole = 'spectator';
  }
  
  updateUIRoles();
}

export function getCurrentRole(): UserRole {
  return currentRole;
}

export function updateUIRoles() {
  const isAdmin = currentRole === 'admin';
  const isStaff = currentRole === 'staff';
  const canEdit = isAdmin || isStaff;

  // Global UI updates
  // Example: hide/show "Nuevo Evento" button
  const btnNewEvent = document.getElementById('btn-new-event');
  if (btnNewEvent) btnNewEvent.style.display = isAdmin ? 'inline-flex' : 'none'; // Only admin can create events? Wait, maybe staff too.
  // Actually, staff usually can't create events, only score them. Let's make "Nuevo Evento" admin-only, 
  // or maybe staff can create them? The user said: "admin tenga control total y que staff permita cosas que tengan que ver con la competicion en vivo nomas". 
  // So creating/deleting events should be Admin only.
  
  if (btnNewEvent) btnNewEvent.style.display = isAdmin ? 'inline-flex' : 'none';

  // Toggle CSS classes to hide elements globally
  document.querySelectorAll('.admin-only').forEach((el: any) => {
    el.style.display = isAdmin ? '' : 'none';
  });

  document.querySelectorAll('.staff-only').forEach((el: any) => {
    if (!canEdit) {
      el.style.display = 'none';
    } else {
      // Si el elemento fue configurado explícitamente con display:none por lógica de UI, mantenerlo oculto
      const inlineStyle = el.getAttribute('style') || '';
      if (inlineStyle.includes('display:none') || inlineStyle.includes('display: none')) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
      }
    }
  });

  // Login / Logout buttons in navbar
  const btnLogin = document.getElementById('nav-btn-login');
  const btnLogout = document.getElementById('nav-btn-logout');
  const userBadge = document.getElementById('nav-user-badge');

  if (currentRole === 'spectator') {
    if (btnLogin) btnLogin.style.display = 'flex';
    if (btnLogout) btnLogout.style.display = 'none';
    if (userBadge) userBadge.style.display = 'none';
  } else {
    if (btnLogin) btnLogin.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'flex';
    if (userBadge) {
      userBadge.style.display = 'flex';
      userBadge.innerText = currentRole.toUpperCase();
      userBadge.style.background = isAdmin ? '#b7201c' : '#0056b3'; // Red for admin, blue for staff
    }
  }
}

export async function logout() {
  await supabase.auth.signOut();
  currentRole = 'spectator';
  updateUIRoles();
}
