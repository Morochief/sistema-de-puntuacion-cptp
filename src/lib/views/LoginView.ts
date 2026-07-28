import { supabase } from '../supabase';
import { checkAuth } from '../authManager';
import { navigate } from '../router';
import { showToast } from '../modals';

export async function renderLogin() {
  const container = document.getElementById('view-login');
  if (!container) return;

  container.innerHTML = `
    <div class="login-container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:75vh;padding:20px;animation:fadeIn 0.6s ease-out;">
      <div class="login-card" style="background:#ffffff;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05);width:100%;max-width:400px;overflow:hidden;position:relative;">
        
        <!-- Paraguayan Header Banner -->
        <div style="height:6px;width:100%;display:flex;">
          <div style="flex:1;background:#D52B1E;"></div> <!-- Red -->
          <div style="flex:1;background:#FFFFFF;"></div> <!-- White -->
          <div style="flex:1;background:#0038A8;"></div> <!-- Blue -->
        </div>

        <div style="padding:40px 32px;display:flex;flex-direction:column;align-items:center;gap:24px;">
          
          <!-- Logos Container -->
          <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px;">
            <img src="/logo-cptp.svg" alt="CPTP" style="height:70px;width:auto;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.1));animation:slideInLeft 0.8s ease-out;" />
            <div style="width:2px;height:40px;background:linear-gradient(to bottom, transparent, #cbd5e1, transparent);"></div>
            <img src="/logo-long-range.svg" alt="Long Range" style="height:70px;width:auto;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.1));animation:slideInRight 0.8s ease-out;" />
          </div>

          <div style="text-align:center;">
            <h2 style="font-family:'Orbitron',sans-serif;font-size:1.5rem;font-weight:900;color:#0f1f3d;margin:0 0 4px 0;letter-spacing:0.02em;">ACCESO RESTRINGIDO</h2>
            <p style="font-family:'Rajdhani',sans-serif;font-size:0.95rem;color:#64748b;margin:0;font-weight:500;">Ingrese sus credenciales de Staff o Administrador</p>
          </div>

          <form id="login-form" style="width:100%;display:flex;flex-direction:column;gap:20px;">
            <div class="input-group">
              <label style="font-family:'Rajdhani',sans-serif;font-weight:700;color:#475569;font-size:0.9rem;display:block;margin-bottom:6px;">Correo Electrónico</label>
              <input type="email" id="login-email" required placeholder="ejemplo@cptp.com" 
                style="width:100%;padding:12px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:1rem;transition:all 0.3s ease;outline:none;" 
                onfocus="this.style.borderColor='#0038A8';this.style.boxShadow='0 0 0 4px rgba(0,56,168,0.1)'" 
                onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'" />
            </div>

            <div class="input-group">
              <label style="font-family:'Rajdhani',sans-serif;font-weight:700;color:#475569;font-size:0.9rem;display:block;margin-bottom:6px;">Contraseña</label>
              <input type="password" id="login-password" required placeholder="••••••••" 
                style="width:100%;padding:12px 16px;border:2px solid #e2e8f0;border-radius:10px;font-size:1rem;transition:all 0.3s ease;outline:none;"
                onfocus="this.style.borderColor='#0038A8';this.style.boxShadow='0 0 0 4px rgba(0,56,168,0.1)'" 
                onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'" />
            </div>

            <button type="submit" id="btn-submit-login" 
              style="width:100%;padding:14px;background:linear-gradient(135deg, #0038A8 0%, #002b80 100%);color:white;border:none;border-radius:10px;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:1.1rem;letter-spacing:0.05em;cursor:pointer;box-shadow:0 4px 12px rgba(0,56,168,0.3);transition:transform 0.2s, box-shadow 0.2s;margin-top:8px;"
              onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(0,56,168,0.4)'"
              onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(0,56,168,0.3)'">
              INGRESAR AL SISTEMA
            </button>
          </form>

        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const btnSubmit = container.querySelector('#btn-submit-login') as HTMLButtonElement;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (container.querySelector('#login-email') as HTMLInputElement).value;
    const password = (container.querySelector('#login-password') as HTMLInputElement).value;

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="spinner" style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-radius:50%;border-top-color:#fff;animation:spin 1s ease-in-out infinite;"></span> Ingresando...`;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      showToast('Credenciales incorrectas', 'error');
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = 'INGRESAR AL SISTEMA';
    } else {
      showToast('Sesión iniciada correctamente', 'success');
      await checkAuth();
      navigate('/dashboard');
    }
  });
}
