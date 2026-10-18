import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sound } from '../utils/soundEffects';
import { X, Lock, Mail, User, Globe, FileText, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
}

const COUNTRIES = [
  { code: 'MX', name: 'México', flag: '🇲🇽', defaultDoc: 'curp' },
  { code: 'ES', name: 'España', flag: '🇪🇸', defaultDoc: 'dni' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', defaultDoc: 'dni' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', defaultDoc: 'cedula' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', defaultDoc: 'cedula' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪', defaultDoc: 'dni' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', defaultDoc: 'national_id' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', defaultDoc: 'national_id' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾', defaultDoc: 'cedula' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨', defaultDoc: 'cedula' },
  { code: 'INT', name: 'Internacional / Otro', flag: '🌐', defaultDoc: 'passport' },
];

const AVATARS = ['😎', '🥷', '⚡', '👑', '💎', '🐺', '🦁', '🍇', '🔥', '🎯'];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
}) => {
  const { registerUser, loginUser, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentType, setDocumentType] = useState<'passport' | 'national_id' | 'dni' | 'cedula'>('dni');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        const cleanUser = username.trim();
        const cleanDoc = documentNumber.trim();
        const cleanEmail = email.trim();

        if (!cleanUser || cleanUser.length < 3) {
          throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');
        }
        if (!/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
          throw new Error('El nombre de usuario solo puede contener letras, números y guión bajo.');
        }
        if (!cleanDoc || cleanDoc.length < 4) {
          throw new Error('Ingresa un número de documento válido (mínimo 4 caracteres).');
        }
        if (password.length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres.');
        }

        await registerUser({
          email: cleanEmail,
          password,
          username: cleanUser,
          documentNumber: cleanDoc,
          documentType,
          country: selectedCountry.name,
          countryFlag: selectedCountry.flag,
          avatar: selectedAvatar,
        });

        sound.playJackpot();
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.5 },
        });

        setSuccessMsg('¡Cuenta internacional creada con éxito! +5,000 BerryCoins acreditadas.');
        setTimeout(() => {
          onClose();
        }, 1100);
      } else {
        // Login mode
        await loginUser(email.trim(), password);
        sound.playBet();
        setSuccessMsg('¡Sesión iniciada correctamente! Bienvenido a la Arena Berries.');
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err: unknown) {
      sound.playLoss();
      const raw = err instanceof Error ? err.message : String(err);
      
      if (raw.includes('user-not-found') || raw.includes('invalid-credential') || raw.includes('wrong-password')) {
        setErrorMsg('Credenciales inválidas. Si no tienes cuenta, selecciona la pestaña "Crear Cuenta".');
      } else if (raw.includes('email-already-in-use')) {
        setErrorMsg('Este correo ya está registrado. Inicia sesión con tu contraseña.');
      } else if (raw.includes('weak-password')) {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      } else if (raw.includes('invalid-email')) {
        setErrorMsg('El formato del correo electrónico no es válido.');
      } else if (raw.includes('network-request-failed')) {
        setErrorMsg('Error de conexión a internet. Intenta nuevamente.');
      } else if (raw.includes('ya está registrado por otro jugador')) {
        setErrorMsg(raw);
      } else {
        setErrorMsg('Ocurrió un error al procesar tu solicitud. Intenta nuevamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await loginWithGoogle();
      sound.playBet();
      onClose();
    } catch (err: unknown) {
      sound.playLoss();
      setErrorMsg(err instanceof Error ? err.message : 'Error al conectar con Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-lg bg-[#0a1435] border-2 border-blue-500/50 rounded-3xl p-6 sm:p-8 text-left shadow-2xl shadow-blue-950 max-h-[95vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => {
            sound.playChip();
            onClose();
          }}
          className="absolute top-5 right-5 p-2 rounded-full bg-blue-950 text-slate-400 hover:text-white hover:bg-blue-900 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Mode Tabs */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🍓</span>
            <span className="text-xs font-black tracking-widest uppercase text-cyan-400 font-display">
              BERRIES.BET · ARENA INTERNACIONAL
            </span>
          </div>

          <div className="flex items-center p-1 rounded-xl bg-blue-950/80 border border-blue-600/30">
            <button
              type="button"
              onClick={() => {
                sound.playChip();
                setMode('login');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-extrabold uppercase tracking-wide rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playChip();
                setMode('register');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-extrabold uppercase tracking-wide rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Crear Cuenta (Registro)
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-300 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-300 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              {/* Unique Username */}
              <div>
                <label className="text-xs uppercase font-extrabold text-cyan-300 block mb-1">
                  Nombre de Usuario Único
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej. CyberValkyrie_99"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-blue-950 border border-blue-600/40 text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Identificador visible en salas de apuestas PvP (letras, números y guión bajo).
                </span>
              </div>

              {/* International Country Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase font-extrabold text-cyan-300 block mb-1">
                    País / Región
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <select
                      value={selectedCountry.code}
                      onChange={(e) => {
                        const found = COUNTRIES.find((c) => c.code === e.target.value);
                        if (found) setSelectedCountry(found);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-blue-950 border border-blue-600/40 text-xs font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Document Type */}
                <div>
                  <label className="text-xs uppercase font-extrabold text-cyan-300 block mb-1">
                    Tipo de Documento
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value as 'passport' | 'national_id' | 'dni' | 'cedula')}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-blue-950 border border-blue-600/40 text-xs font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="dni" className="bg-slate-900">DNI / NIF</option>
                      <option value="cedula" className="bg-slate-900">Cédula de Identidad</option>
                      <option value="passport" className="bg-slate-900">Pasaporte Internacional</option>
                      <option value="national_id" className="bg-slate-900">National ID Card</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Document Number */}
              <div>
                <label className="text-xs uppercase font-extrabold text-cyan-300 block mb-1">
                  Número de Documento Oficial
                </label>
                <input
                  type="text"
                  required
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ej. 12345678Z o Pasaporte A198274"
                  className="w-full px-4 py-2.5 rounded-xl bg-blue-950 border border-blue-600/40 text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Requerido para verificación y prevención de cuentas duplicadas internacionales.
                </span>
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="text-xs uppercase font-extrabold text-cyan-300 block mb-1">
                  Elige tu Avatar de Jugador
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {AVATARS.map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => {
                        sound.playChip();
                        setSelectedAvatar(av);
                      }}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                        selectedAvatar === av
                          ? 'bg-cyan-500 border-2 border-white scale-110 shadow-md shadow-cyan-600/50'
                          : 'bg-blue-950 hover:bg-blue-900 border border-blue-600/30'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="text-xs uppercase font-extrabold text-cyan-300 block mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@ejemplo.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-blue-950 border border-blue-600/40 text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs uppercase font-extrabold text-cyan-300 block mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-blue-950 border border-blue-600/40 text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
            {mode === 'login' && (
              <span className="text-[10px] text-slate-400 mt-1 block">
                Solo los usuarios con cuenta creada pueden iniciar sesión.
              </span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-sm uppercase tracking-wider font-display shadow-xl shadow-cyan-950/60 cursor-pointer disabled:opacity-50 transition-all"
          >
            {isSubmitting
              ? 'PROCESANDO EN FIREBASE...'
              : mode === 'register'
              ? 'CREAR CUENTA & OBTENER +5,000 BC'
              : 'INICIAR SESIÓN EN LA ARENA'}
          </button>
        </form>

        {/* Google Alternative Login */}
        <div className="mt-4 pt-4 border-t border-blue-900/60 text-center">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-600/40 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continuar con Google</span>
          </button>
        </div>
      </div>
    </div>
  );
};
