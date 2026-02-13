'use client';

import React from 'react';
import { MessageCircle, MapPin, Calendar, ArrowRight, Mountain, ShieldCheck, Ticket, Coffee, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Definimos una interfaz para evitar errores de TypeScript con el objeto window
declare global {
  interface Window {
    fbq: any;
  }
}

const LandingPage = () => {
  const router = useRouter();
  const whatsappNumber = "573128762526";
  const mensajeDefault = "¡Hola! Quiero inscribirme en la 2da Toma Caminera en Carolina del Príncipe. Me interesa el cupo de $90.000 que incluye el kit y las 2 rutas.";

  const handleWhatsAppClick = () => {
    // --- LÍNEA PARA EL META PIXEL ---
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Contact', {
        content_name: 'Inscripción Toma Caminera',
        value: 90000,
        currency: 'COP'
      });
    }
    // --------------------------------

    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensajeDefault)}`;
    window.open(url, '_blank');
    
    setTimeout(() => {
      router.push('/');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* HERO SECTION: IMPACTO VISUAL */}
      <header className="relative h-[90vh] flex items-center justify-center text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent z-10" />
        
        <div 
          className="absolute inset-0 bg-cover bg-center scale-155 animate-slow-zoom" 
          style={{ backgroundImage: "url('https://firebasestorage.googleapis.com/v0/b/caroltur-2023.appspot.com/o/tomaCaminera%2FIMG-20200224-WA0029.jpg?alt=media&token=7d705428-4083-497f-ad49-4f7b40d5143f')" }}
        />
        
        <div className="relative z-20 container mx-auto px-4 text-center">
          <div className="inline-flex items-center space-x-2 bg-black/20 backdrop-blur-md border border-white/30 px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-xs md:text-sm font-bold uppercase tracking-[0.2em]">El Jardín Colonial de América</span>
          </div>
          
          <h1 className="text-5xl md:text-8xl font-black mb-6 tracking-tighter leading-none">
            EL PUEBLO QUE <br/> <span className="text-green-500">ENAMORA</span>
          </h1>
          
          <p className="text-xl md:text-2xl mb-10 font-light max-w-2xl mx-auto text-gray-200">
            Vive la 2da Toma Caminera en <span className="font-bold text-white">Carolina del Príncipe</span>. 
            Naturaleza, historia y aventura en un solo lugar.
          </p>

          <button 
            onClick={handleWhatsAppClick}
            className="group bg-green-500 hover:bg-green-600 text-black font-black py-5 px-10 rounded-full text-xl inline-flex items-center transition-all shadow-[0_10px_30px_rgba(34,197,94,0.4)]"
          >
            QUIERO MI CUPO POR $90.000
            <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </header>

      {/* SECCIÓN DE VALOR: ¿QUÉ INCLUYE? */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-white rounded-[3rem] shadow-xl overflow-hidden flex flex-col md:flex-row">
            <div className="bg-green-600 text-white p-12 md:w-1/3 flex flex-col justify-center items-center text-center">
              <Ticket className="w-16 h-16 mb-4 opacity-50" />
              <h2 className="text-4xl font-black mb-2">$90k</h2>
              <p className="text-green-100 font-bold uppercase text-xs tracking-widest">Inversión Total</p>
            </div>
            
            <div className="p-12 md:w-2/3">
              <h3 className="text-2xl font-bold mb-6">Tu inscripción incluye:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-3 text-gray-700">
                  <ShieldCheck className="text-green-500 w-5 h-5" /> <span>Póliza de seguro</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-700">
                  <Sparkles className="text-green-500 w-5 h-5" /> <span>Souvenir exclusivo</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-700">
                  <Coffee className="text-green-500 w-5 h-5" /> <span>Refrigerios</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-700">
                  <Mountain className="text-green-500 w-5 h-5" /> <span>Elección de 2 rutas</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-700">
                  <MapPin className="text-green-500 w-5 h-5" /> <span>Toda la programación</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CIFRAS CLAVE */}
      <section className="py-20 container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-12 text-center">
          <div>
            <h4 className="text-6xl font-black text-green-600 mb-2">10</h4>
            <p className="text-gray-500 uppercase font-bold tracking-widest text-sm">Rutas Únicas</p>
          </div>
          <div>
            <h4 className="text-6xl font-black text-blue-600 mb-2">3</h4>
            <p className="text-gray-500 uppercase font-bold tracking-widest text-sm">Días de Aventura</p>
          </div>
          <div>
            <h4 className="text-6xl font-black text-orange-600 mb-2">20-23</h4>
            <p className="text-gray-500 uppercase font-bold tracking-widest text-sm">Marzo 2026</p>
          </div>
        </div>
      </section>

      {/* CTA FINAL: ENFOQUE WHATSAPP */}
      <section className="py-24 bg-black text-white text-center relative overflow-hidden">
        <div className="relative z-10 container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-black mb-6">¿LISTO PARA ENAMORARTE?</h2>
          <p className="text-gray-400 mb-10 max-w-lg mx-auto">
            Carolina del Príncipe te espera con sus fachadas coloniales y sus senderos mágicos. 
            ¡Escríbenos ahora mismo y separa tu cupo!
          </p>
          <button 
            onClick={handleWhatsAppClick}
            className="flex items-center mx-auto bg-white text-black font-black py-4 px-12 rounded-full text-lg hover:bg-green-400 transition-all transform hover:scale-110"
          >
            <MessageCircle className="mr-2" />
            HABLAR CON UN ASESOR
          </button>
        </div>
      </section>

      <footer className="py-8 text-center text-gray-500 text-[10px] uppercase tracking-[0.3em]">
        © 2026 Carolina del Príncipe - El Jardín Colonial de América
      </footer>

      {/* Estilos para la animación del Hero */}
      <style jsx global>{`
        @keyframes slow-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        .animate-slow-zoom {
          animation: slow-zoom 20s infinite alternate ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;