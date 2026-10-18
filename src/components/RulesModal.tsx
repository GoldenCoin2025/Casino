import React from 'react';
import { X, Swords, Scale, Award, Info, AlertTriangle, Clock, Layers } from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-[#091538] border-2 border-blue-500/50 rounded-3xl p-6 sm:p-8 text-left shadow-2xl shadow-blue-950 max-h-[90vh] overflow-y-auto">
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

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            <Swords className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white font-display">
              REGLAS & MODALIDAD DE DUELOS PVP
            </h2>
            <p className="text-xs text-cyan-300 font-bold">
              Berries.bet Arena · Duelos en Vivo & Asincrónicos (24h)
            </p>
          </div>
        </div>

        <div className="space-y-6 mt-6 text-sm text-slate-300">
          {/* Rule 1: Apuesta Mínima 25 Pesos */}
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              1. Ventana de Apuesta Manual (Mínimo 25 Pesos)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-2">
              Antes de ingresar a cualquier juego, se abrirá una ventana emergente donde cada usuario digita manualmente el monto a apostar. La apuesta mínima en todos los juegos de la plataforma es de <strong>25 pesos</strong>.
            </p>
            <div className="p-3 rounded-xl bg-blue-950/80 border border-blue-500/30 text-xs font-mono font-bold text-amber-300 text-center">
              Pozo Total en Juego = Tu Apuesta + Apuesta Rival (¡El ganador se lleva el 100%!)
            </div>
          </div>

          {/* Rule 2: Juego de Apilar Bloques */}
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              2. Apilar Bloques PvP (Física & Colisiones)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-2">
              Los bloques oscilan a velocidad creciente. Al presionar sobre la pantalla o presionar [Espacio], el bloque cae sobre la torre:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300">
              <li><strong>Alineación Perfecta:</strong> Otorga bonificación de combo y destellos de partículas.</li>
              <li><strong>Desfase / Mal Ubicado:</strong> Los extremos sobrantes se cortan al instante, caen al suelo por gravedad y estallan en partículas. El bloque útil se reduce de tamaño.</li>
              <li><strong>Fallo Total:</strong> La torre colapsa y la partida finaliza. El jugador con mayor cantidad de pisos gana el pozo.</li>
            </ul>
          </div>

          {/* Rule 3: Modo Asincrónico & Reloj de 24 Horas */}
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              3. Matchmaking & Modo Asincrónico (Reloj de 24 Horas)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-2">
              Al entrar a la sala, el sistema busca emparejarte en vivo mostrando el nick y avatar de ambos jugadores. Si no hay rival conectado:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-300">
              <li>El juego se disputa en <strong>Modo Asincrónico</strong>: realizas tu partida en solitario y se guarda tu puntuación.</li>
              <li>La partida pasa al menú <strong>"Partidas Pendientes"</strong> de la barra superior con un <strong>reloj de cuenta regresiva de 24 horas</strong>.</li>
              <li><strong>Si nadie acepta el versus en 24h:</strong> Tus monedas se devuelven al 100% a tu saldo.</li>
              <li><strong>Si alguien acepta el versus:</strong> Se comparan las puntuaciones y el resultado con el premio se informa en la sección de <strong>Notificaciones</strong>.</li>
            </ul>
          </div>

          {/* Rule 4: Piedra, Papel o Tijera Mejor de 3 */}
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-rose-400" />
              4. Piedra, Papel o Tijera al Mejor de 3
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Duelo estratégico al mejor de 3 rondas. El primer jugador en acumular 2 victorias de mano gana el pozo completo.
            </p>
          </div>

          {/* Legal / Recreativo */}
          <div className="p-3.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs text-cyan-200/90 leading-relaxed">
              <strong>Plataforma Recreativa:</strong> Berries.bet es un entorno de juego competitivo con monedas virtuales. No utiliza dinero real.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 pt-4 border-t border-blue-900/60 flex justify-end">
          <button
            onClick={() => {
              sound.playChip();
              onClose();
            }}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
          >
            Entendido, volver a jugar
          </button>
        </div>
      </div>
    </div>
  );
};
