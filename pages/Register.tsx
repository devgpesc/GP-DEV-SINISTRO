
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { Link, useNavigate, useSearchParams } = ReactRouterDOM as any;
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { auditService } from '../services/auditService';
import { Mail, Lock, User, Loader2, ArrowLeft, Building, AlertCircle, Link as LinkIcon, Eye, EyeOff } from 'lucide-react';
import EscLogo from '../components/EscLogo';

const PENDING_REGISTRATION_STORAGE_KEY = 'sb-autoclaims-pending-registration';

const Register: React.FC = () => {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State para Convite
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [verifyingInvite, setVerifyingInvite] = useState(false);

  useEffect(() => {
    const token = searchParams.get('invite');
    if (token) {
        setInviteToken(token);
        verifyInvite(token);
    }
  }, [searchParams]);

  const verifyInvite = async (token: string) => {
      setVerifyingInvite(true);
      setError(null);
      try {
          // Utiliza a RPC segura que fura o RLS sob medida
          const { data: invite, error: inviteError } = await supabase.rpc('get_invite_details', { invite_token: token });

          if (inviteError) throw inviteError;
          if (!invite) throw new Error("Convite inválido ou expirado.");

          // Monta o objeto com os dados recebidos via RPC
          setInviteData({ ...invite, tenant_name: invite.tenant_name });
          setEmail(invite.email || '');
          setName(invite.name || '');
          setCompanyName(invite.tenant_name || 'Empresa Convidada');
          
      } catch (err: any) {
          console.error("Erro ao verificar convite:", err);
          setError(err.message || "Erro ao carregar dados do convite.");
          setInviteToken(null);
      } finally {
          setVerifyingInvite(false);
      }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validação Básica
    if (!name.trim() || !email.trim() || !password.trim()) {
        setError("Por favor, preencha todos os campos obrigatórios (Nome, E-mail e Senha).");
        setLoading(false);
        return;
    }

    if (!inviteToken && !companyName.trim()) {
        setError("O nome da empresa é obrigatório para criar uma nova conta.");
        setLoading(false);
        return;
    }

    try {
      // 1. Criar Usuário na Auth
      const { data, error: signUpError } = await (supabase.auth as any).signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { 
            full_name: name,
            name: name
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes("unique")) {
            throw new Error("Este e-mail já está cadastrado. Tente fazer login.");
        } else {
            throw signUpError;
        }
      } 
      
      if (data.user) {
        // === FLUXO DE CONVITE (JOIN EXISTING TENANT) ===
        if (inviteToken && inviteData) {
             try {
                 // A. Aceitar convite com RPC segura no banco
                 const { error: acceptError } = await supabase.rpc('accept_invite', { invite_token: inviteToken });
                 if (acceptError) throw acceptError;

                 // D. Auditoria
                 await auditService.log('Accept Invite', 'Invitation', inviteData.id, { tenant: inviteData.tenant_id });
                 
                 addToast('success', 'Cadastro Concluído!', `Você agora faz parte de ${companyName}.`);
                 
                 // Login automático se possível ou redirecionamento
                 setTimeout(() => {
                     if (data.session) navigate('/');
                     else navigate('/login');
                 }, 1500);
                 
                 return;

             } catch (inviteErr: any) {
                 console.error("Erro ao processar convite:", inviteErr);
                 setError("Conta criada, mas houve erro ao entrar na empresa. Entre em contato com o suporte.");
                 setLoading(false);
                 return;
             }
        }

        // === FLUXO PADRÃO (CRIAR NOVA EMPRESA) ===
        if (data.session) {
             try {
                 // A. Busca um plano padrão (Trial)
                 const { data: plans } = await supabase.from('saas_plans').select('id').limit(1);
                 const defaultPlanId = (plans && plans.length > 0 && plans[0].id) ? plans[0].id : null;

                 // B. Criar a Empresa (Tenant)
                 // Nota: A política RLS deve permitir INSERT para authenticated users onde owner_id = auth.uid()
                 const { data: tenant, error: tenantError } = await supabase
                    .from('saas_tenants')
                    .insert([{
                        name: companyName,
                        status: 'active',
                        owner_id: data.user.id, // Importante: Define o dono imediatamente
                        plan_id: defaultPlanId,
                        document: '00.000.000/0001-00',
                        subscription_status: 'trial',
                        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
                    }])
                    .select()
                    .single();

                 if (tenantError) throw tenantError;

                 // C. Vincular Usuário à Empresa como Owner (Membro)
                 if (tenant) {
                     const { error: memberError } = await supabase.from('organization_members').insert([{
                         tenant_id: tenant.id,
                         user_id: data.user.id,
                         role: 'owner'
                     }]);
                     
                     if (memberError) console.warn("Erro ao vincular membro:", memberError);
                 }

                 // D. Atualizar Perfil para Admin
                 await supabase.from('profiles').upsert({
                     id: data.user.id,
                     email: data.user.email,
                     role: 'Admin',
                     full_name: name,
                     permissions: {
                        financial_view: true, 
                        approve_purchases: true, 
                        manage_users: true, 
                        delete_records: true,
                        view_reports: true
                     },
                     updated_at: new Date().toISOString()
                 });

                 // E. Auditoria e Toast
                 await auditService.log('Register', 'User', data.user.id, { email: data.user.email, company: companyName });
                 
                 addToast('success', 'Conta Criada!', `Bem-vindo à ${companyName}.`);
                 
                 setTimeout(() => navigate('/'), 1500);

             } catch (createError: any) {
                 console.error("Erro ao criar empresa:", createError);
                 setError("Usuário criado, mas houve erro ao configurar a empresa: " + createError.message);
                 setLoading(false);
             }
        } else {
             // Caso exija confirmação de email
             localStorage.setItem(PENDING_REGISTRATION_STORAGE_KEY, JSON.stringify({
                email,
                name,
                companyName: inviteToken ? undefined : companyName,
                inviteToken: inviteToken || undefined,
                createdAt: new Date().toISOString()
             }));
             addToast('success', 'Cadastro Realizado!', 'Verifique seu e-mail para confirmar a conta.');
             setError("Conta criada! Por favor, verifique sua caixa de entrada (e spam) para confirmar o e-mail.");
             setLoading(false); 
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro de conexão. Verifique sua internet e tente novamente.");
      setLoading(false);
    }
  };

  if (verifyingInvite) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={32}/></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10 flex flex-col items-center">
           {/* LOGO OFICIAL (Mesma do Login) */}
           <div className="mb-6 scale-125">
             <EscLogo className="w-16 h-16 text-slate-900" classNameText="text-slate-900 text-3xl" />
           </div>
           
           <h2 className="text-3xl font-black text-slate-800 tracking-tighter mt-2">EVENT<span className="text-blue-600">PRO</span></h2>
        </div>

        <Link to={inviteToken ? `/login?invite=${inviteToken}` : "/login"} className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase tracking-widest mb-6 transition-colors">
          <ArrowLeft size={16}/> {inviteToken ? 'Já tenho conta, entrar' : 'Voltar ao Login'}
        </Link>

        <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-100">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
              {inviteToken ? 'Aceitar Convite' : 'Criar Conta Empresarial'}
          </h2>
          {inviteToken ? (
             <p className="text-sm text-blue-600 font-bold mb-6 flex items-center gap-2"><LinkIcon size={14}/> Você foi convidado para: {companyName}</p>
          ) : (
             <p className="text-sm text-slate-500 font-medium mb-6">Comece a gerenciar sua frota e sinistros hoje.</p>
          )}
          
          {error && (
            <div className={`mb-6 p-4 border rounded-2xl flex items-start gap-3 text-xs font-bold animate-in slide-in-from-top-2 ${error.includes('verifique') ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
                <AlertCircle size={18} className="shrink-0 mt-0.5"/> 
                <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            {!inviteToken && (
                <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">Nome da Sua Empresa</label>
                <div className="relative">
                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex: Transportadora Silva" />
                </div>
                </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">Seu Nome</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="email" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@empresa.com" readOnly={!!inviteToken} />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-2 tracking-widest">Definir Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Mínimo 6 caracteres" 
                />
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-1"
                >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4">
              {loading ? <Loader2 className="animate-spin" size={20} /> : (inviteToken ? 'Entrar na Empresa' : 'Criar Conta & Acessar')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
